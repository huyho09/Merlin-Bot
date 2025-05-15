import requests

url =  'http://127.0.0.1:5001/api/login'

header = {
    "Content-Type" : "application/json"
}
body = {
    "username" : "admin",
    "password" : "Password@123"
}
proxy = { 
    "http" : "http://localhost:3128",
    "https" : "http://localhost:3128",
    "no_proxy" : "http://localhost:3128"
}
response = requests.post(url=url, headers=header,json=body,proxies=proxy)

print(response.status_code)