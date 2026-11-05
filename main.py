from fastapi import FastAPI

app = FastAPI()

menu = [
    {
        "id": "americano",
        "name": "아메리카노",
        "price": 3000,
        "sold_out": False,
    },
    {
        "id": "latte",
        "name": "카페라떼",
        "price": 3800,
        "sold_out": False,
    },
]

@app.get("/")
def read_root():
    return {"message": "성공"}

@app.get("/api/menu")
def read_menu():
    return {"items": menu}
