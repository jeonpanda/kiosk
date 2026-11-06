const $ = selector => document.querySelector(selector);
const labels = { received: '접수', preparing: '제조 중', ready: '준비 완료', completed: '전달 완료' };
let orders = [];
let filter = 'all';
let loggedIn = false;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const money = value => Number(value || 0).toLocaleString('ko-KR') + '원';

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(typeof data.detail === 'string' ? data.detail : '요청을 처리하지 못했습니다.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function showLogin() {
  loggedIn = false;
  $('#login').hidden = false;
  $('#dashboard').hidden = true;
  $('#logout').hidden = true;
  $('#password').focus();
}

function showDashboard() {
  loggedIn = true;
  $('#login').hidden = true;
  $('#dashboard').hidden = false;
  $('#logout').hidden = false;
}

function renderStats() {
  $('#stats').innerHTML = [
    ['접수', 'received'], ['제조 중', 'preparing'], ['준비 완료', 'ready'], ['전달 완료', 'completed']
  ].map(([name, status]) => `<div class="stat"><span>${name}</span><strong>${orders.filter(order => order.status === status).length}</strong></div>`).join('');
}

function renderOrders() {
  const visible = filter === 'all' ? orders : orders.filter(order => order.status === filter);
  $('#orders').innerHTML = visible.length ? visible.map(order => {
    const status = labels[order.status] ? order.status : 'received';
    const date = order.createdAt ? new Date(order.createdAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    return `<article class="order-card">
      <div class="order-top"><div><div class="order-number">#${escapeHtml(order.orderNumber)}</div><div class="order-date">${escapeHtml(date)}</div></div><span class="status status-${status}">${labels[status]}</span></div>
      <p class="order-meta">${escapeHtml(order.place)} · ${Number(order.count) || 0}개 메뉴 · 가상 결제</p>
      <ul class="order-items">${(order.items || []).map(item => `<li><span>${escapeHtml(item.name)} <small>${escapeHtml(item.temp || '기본')} × ${Number(item.quantity) || 0}</small></span><span>${money(item.lineTotal)}</span></li>`).join('')}</ul>
      <div class="order-footer"><strong>${money(order.total)}</strong><label>진행 상태<select data-order-id="${escapeHtml(order.id)}">${Object.entries(labels).map(([key, label]) => `<option value="${key}" ${key === status ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div>
    </article>`;
  }).join('') : '<div class="empty">해당하는 주문이 없습니다.</div>';
}

async function loadOrders() {
  if (!loggedIn) return;
  try {
    const data = await api('/api/admin/orders');
    orders = data.orders;
    $('#message').textContent = '';
    renderStats();
    renderOrders();
  } catch (error) {
    if (error.status === 401) showLogin();
    else $('#message').textContent = error.message;
  }
}

$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.target.querySelector('button');
  button.disabled = true;
  $('#loginError').textContent = '';
  try {
    await api('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: $('#password').value })
    });
    $('#password').value = '';
    showDashboard();
    await loadOrders();
  } catch (error) {
    $('#loginError').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('#logout').addEventListener('click', async () => {
  await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
  showLogin();
});
$('#refresh').addEventListener('click', loadOrders);
$('#filters').addEventListener('click', event => {
  const next = event.target.dataset.filter;
  if (!next) return;
  filter = next;
  $('#filters').querySelectorAll('button').forEach(button => button.classList.toggle('active', button.dataset.filter === filter));
  renderOrders();
});
$('#orders').addEventListener('change', async event => {
  const select = event.target.closest('select[data-order-id]');
  if (!select) return;
  select.disabled = true;
  try {
    await api(`/api/admin/orders/${encodeURIComponent(select.dataset.orderId)}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: select.value })
    });
    await loadOrders();
  } catch (error) {
    $('#message').textContent = error.message;
    select.disabled = false;
  }
});

api('/api/admin/session').then(() => { showDashboard(); loadOrders(); }).catch(showLogin);
setInterval(() => { if (loggedIn && !document.hidden) loadOrders(); }, 15000);
