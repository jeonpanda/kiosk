from fastapi import FastAPI

app = FastAPI()

menu = [
    {
        "id": "americano",
        "name": "아메리카노",
        "price": 3000,
        "sold_out": False

    },
    {
            "id": "latte",
            "name": "카페라떼",
            "price": 3800,
            "sold_out": False
    },
]

MAX_QUANTITY = 5;


def get_menu():
    result = []
    for menu_id, info in MENU.item():
        result.append({
            "id": menu_id,
            "name": info["name"],
            "price": info["price"],
            "sold_out": info["sold_out"]
        })

@app.get("/")
def read_root():
    return{
        "message" : "성공"
    }

@app.get("/api/menu")
def read_menu():
    return{
        "items": menu
    }