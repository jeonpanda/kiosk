let products = [];

// 주문 상태
let category = '전체';
let cart = [];
let place = '매장';
let selected = null;
let temp = 'ICE';
let amount = 1;
let savingOrder = false;

const $ = selector => document.querySelector(selector);
const money = value => value.toLocaleString('ko-KR') + '원';
const cartCount = () => cart.reduce((sum, item) => sum + item.qty, 0);
const cartTotal = () => cart.reduce((sum, item) => sum + item.price * item.qty, 0);

// 메뉴와 주문 내역
function renderMenu() {
  const list = products.filter(product => category === '전체' || product.cat === category);
  $('#tabs').innerHTML = ['전체', '커피', '논커피', '디저트'].map(name =>
    `<button class="tab ${category === name ? 'active' : ''}" data-category="${name}">${name}</button>`
  ).join('');
  $('#menuCount').textContent = `${list.length}개의 메뉴`;
  $('#grid').innerHTML = list.map(product => `
    <button class="card" data-id="${product.id}" aria-label="${product.name} ${money(product.price)} 선택">
      <div class="photo" style="background-image:url(${product.img.startsWith('images/') ? product.img : `https://images.unsplash.com/${product.img}?auto=format&fit=crop&w=600&q=80`})">
        ${product.tag ? `<span class="tag">${product.tag}</span>` : ''}
      </div>
      <h3>${product.name}</h3><p>${product.desc}</p><div class="price">${money(product.price)}</div>
    </button>`).join('');
}

function renderCart() {
  const count = cartCount();
  $('#cartCount').textContent = count + '개';
  $('#compactCount').textContent = count + '개';
  $('#total').textContent = money(cartTotal());
  $('#pay').disabled = !count;
  $('#cart').innerHTML = cart.length ? cart.map((item, index) => `
    <div class="item">
      <div class="item-line"><span>${item.name}</span><span>${money(item.price * item.qty)}</span></div>
      <small>${item.temp || '기본'}</small>
      <div class="item-controls">
        <div class="qty">
          <button data-minus="${index}" aria-label="${item.name} 수량 줄이기">−</button>
          <span>${item.qty}</span>
          <button data-plus="${index}" aria-label="${item.name} 수량 늘리기">+</button>
        </div>
        <button class="remove" data-remove="${index}">삭제</button>
      </div>
    </div>`).join('') : `
    <div class="empty"><div class="empty-icon">♧</div>아직 담긴 메뉴가 없어요.<br>좋아하는 메뉴를 골라볼까요?</div>`;
}

function setCartExpanded(expanded) {
  $('#sidebar').classList.toggle('expanded', expanded);
  $('#cartToggle').setAttribute('aria-expanded', String(expanded));
  $('#toggleLabel').textContent = expanded ? '접기 ↓' : '펼쳐보기 ↑';
}

// 메뉴 옵션과 결제 모달
function openProduct(product) {
  selected = product;
  temp = 'ICE';
  amount = 1;
  renderProduct();
  $('#overlay').hidden = false;
  $('#modal .close').focus();
}

function renderProduct() {
  const temperatureChoices = selected.cat !== '디저트' ? `
    <div class="option-title">온도를 선택해 주세요</div>
    <div class="choices">
      ${selected.cold ? '' : `<button data-temp="HOT" class="${temp === 'HOT' ? 'active' : ''}">☀ &nbsp; HOT</button>`}
      <button data-temp="ICE" class="${temp === 'ICE' ? 'active' : ''}">❄ &nbsp; ICE</button>
    </div>` : '';
  $('#modal').innerHTML = `
    <div class="modal-top"><div><div class="eyebrow">YOUR SELECTION</div><h2 id="modalTitle">${selected.name}</h2></div><button class="close" aria-label="닫기">×</button></div>
    <p>${selected.desc}</p>${temperatureChoices}
    <div class="modal-bottom"><span>수량</span><div class="qty">
      <button data-amount="minus" aria-label="수량 줄이기">−</button><span>${amount}</span><button data-amount="plus" aria-label="수량 늘리기">+</button>
    </div></div>
    <button class="primary" id="add">${money(selected.price * amount)} 담기</button>`;
}

function closeModal() {
  if (savingOrder) return;
  $('#overlay').hidden = true;
}

function addToCart() {
  const itemTemp = selected.cat === '디저트' ? '' : temp;
  const existing = cart.find(item => item.id === selected.id && item.temp === itemTemp);
  if (existing) existing.qty += amount;
  else cart.push({ ...selected, temp: itemTemp, qty: amount });
  renderCart();
  closeModal();
}

function openCheckout() {
  $('#overlay').hidden = false;
  $('#modal').innerHTML = `
    <div class="modal-top"><div><div class="eyebrow">FINAL CHECK</div><h2 id="modalTitle">주문을 확인해 주세요</h2></div><button class="close" aria-label="닫기">×</button></div>
    <p>${place} 주문 · 총 ${cartCount()}개</p>
    <div class="summary">${cart.map(item => `${item.name} ${item.temp} × ${item.qty}`).join('<br>')}<br><strong>합계 ${money(cartTotal())}</strong></div>
    <p>이 결제는 체험용이며 실제 금액이 청구되지 않습니다.</p>
    <button class="primary" id="confirmPay">가상 결제 완료하기</button>`;
  $('#modal .close').focus();
}

async function completePayment() {
  if (savingOrder || !cart.length) return;
  savingOrder = true;
  const button = $('#confirmPay');
  button.disabled = true;
  button.textContent = '주문 저장 중...';
  const order = { place, items: cart.map(item => ({ id: item.id, temp: item.temp, qty: item.qty })) };
  let saved;
  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });
    saved = await response.json();
    if (!response.ok) throw new Error(saved.error || (typeof saved.detail === 'string' ? saved.detail : '주문을 저장하지 못했습니다.'));
  } catch (error) {
    button.disabled = false;
    button.textContent = '다시 시도하기';
    let message = $('#orderError');
    if (!message) {
      message = document.createElement('p');
      message.id = 'orderError';
      message.setAttribute('role', 'alert');
      button.before(message);
    }
    message.textContent = error.message || '주문 저장에 실패했습니다.';
    savingOrder = false;
    return;
  }
  const { total, count, orderNumber } = saved;
  $('#modal').innerHTML = `
    <div class="success"><div class="success-icon">✓</div><div class="eyebrow">ORDER COMPLETE</div>
      <h2 id="modalTitle">주문이 완료되었어요!</h2><p>주문번호가 호출되면 픽업해 주세요.</p>
      <div class="number">${orderNumber}</div><div class="summary">${place} · ${count}개 메뉴<br>가상 결제 금액 ${money(total)}</div>
      <button class="primary" id="restart">새 주문 시작하기</button>
    </div>`;
  cart = [];
  renderCart();
  setCartExpanded(false);
  savingOrder = false;
}

function restartOrder() {
  closeModal();
  category = '전체';
  renderMenu();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 사용자 입력
$('#tabs').onclick = event => {
  if (event.target.dataset.category) {
    category = event.target.dataset.category;
    renderMenu();
  }
};
$('#grid').onclick = event => {
  const card = event.target.closest('[data-id]');
  if (card) openProduct(products.find(product => product.id === Number(card.dataset.id)));
};
$('#place').onclick = event => {
  if (!event.target.dataset.place) return;
  place = event.target.dataset.place;
  document.querySelectorAll('#place button').forEach(button => button.classList.toggle('active', button.dataset.place === place));
};
$('#cartToggle').onclick = () => setCartExpanded(!$('#sidebar').classList.contains('expanded'));
$('#cart').onclick = event => {
  const data = event.target.dataset;
  if (data.plus !== undefined) cart[+data.plus].qty++;
  if (data.minus !== undefined) {
    const index = +data.minus;
    if (--cart[index].qty === 0) cart.splice(index, 1);
  }
  if (data.remove !== undefined) cart.splice(+data.remove, 1);
  renderCart();
};
$('#modal').onclick = event => {
  const data = event.target.dataset;
  if (event.target.closest('.close')) closeModal();
  else if (data.temp) { temp = data.temp; renderProduct(); }
  else if (data.amount) { amount = Math.max(1, amount + (data.amount === 'plus' ? 1 : -1)); renderProduct(); }
  else if (event.target.id === 'add') addToCart();
  else if (event.target.id === 'confirmPay') completePayment();
  else if (event.target.id === 'restart') restartOrder();
};
$('#pay').onclick = openCheckout;
$('#overlay').onclick = event => { if (event.target === $('#overlay')) closeModal(); };
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
renderCart();
fetch('catalog.json')
  .then(response => {
    if (!response.ok) throw new Error('메뉴를 불러오지 못했습니다.');
    return response.json();
  })
  .then(catalog => { products = catalog; renderMenu(); })
  .catch(() => { $('#grid').textContent = '메뉴를 불러오지 못했습니다. 새로고침해 주세요.'; });
