# 오후의 커피 키오스크

카페 메뉴를 선택하고 주문하는 웹 화면과 FastAPI 서버입니다. 주문은 MongoDB의 `orders` 컬렉션에 저장되며, 관리자 화면에서 최근 주문과 처리 상태를 관리할 수 있습니다. 결제는 체험용으로 실제 결제가 이루어지지 않습니다.

## 준비

- Python 3.11 이상
- 접속 가능한 MongoDB 인스턴스와 데이터베이스 사용자

PowerShell에서 프로젝트 폴더로 이동해 가상 환경과 환경 설정 파일을 만듭니다.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

`.env`의 `MONGODB_URI`를 실제 MongoDB 연결 문자열로 바꾸고 `ADMIN_PASSWORD`에 관리자 비밀번호를 설정합니다. 필요하면 `MONGODB_DB`도 변경합니다. URI의 사용자 이름이나 비밀번호에 특수 문자가 있다면 URL 인코딩해야 합니다. `.env`는 비밀 정보이므로 공유하거나 커밋하지 마세요.

## 실행

```powershell
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

- 주문 화면: http://127.0.0.1:8000/
- 관리자 화면: http://127.0.0.1:8000/admin.html
- API 문서: http://127.0.0.1:8000/docs
- DB 연결 확인: http://127.0.0.1:8000/api/health

관리자 화면에서는 `ADMIN_PASSWORD`로 로그인하고 최근 100건의 주문을 확인하거나 상태를 변경할 수 있습니다. 환경 설정을 변경한 후에는 서버를 다시 시작하세요. MongoDB 접속에 실패하면 연결 문자열, 계정 권한과 네트워크 접근 허용 설정을 확인하세요.

## 프로젝트 구성

- `app.py`: 주문 및 관리자 API, 정적 화면 제공
- `dist/`: 실행에 필요한 화면 파일과 메뉴 데이터 (`catalog.json`)
- `.env.example`: 환경 변수 예시
- `requirements.txt`: Python 의존성

관리자 세션은 서버 메모리에 저장되므로 재시작하면 로그아웃됩니다. 운영 환경에서 사용하려면 HTTPS와 함께 인증, 세션 저장 및 배포 구성을 별도로 검토해야 합니다. 정적 호스팅만으로는 주문 API와 데이터베이스 기능이 동작하지 않습니다.
