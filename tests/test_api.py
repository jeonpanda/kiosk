import unittest

from fastapi.testclient import TestClient

from main import app


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_root(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"message": "성공"})

    def test_menu(self):
        response = self.client.get("/api/menu")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"items": [
            {"id": "americano", "name": "아메리카노", "price": 3000, "sold_out": False},
            {"id": "latte", "name": "카페라떼", "price": 3800, "sold_out": False},
        ]})


if __name__ == "__main__":
    unittest.main()
