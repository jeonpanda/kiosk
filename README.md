# 키오스크 API

Python 가상 환경을 만들고 의존성을 설치한 후 서버를 실행합니다.

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn main:app --reload
```

서버는 기본적으로 http://127.0.0.1:8000 에서 실행되며, `/api/menu`에서 메뉴를 조회하고 `/docs`에서 API 문서를 볼 수 있습니다. 현재 메뉴는 코드에 저장되어 있으며 MongoDB 연결은 사용하지 않습니다.

테스트를 실행하려면 개발 의존성을 설치합니다.

```powershell
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
.\.venv\Scripts\python -m unittest discover -s tests
```

인증 정보와 연결 문자열은 커밋하지 마세요. `.env` 파일과 `mongodb.txt`는 Git에서 제외됩니다.
