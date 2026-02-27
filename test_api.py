import time
import urllib.request
import urllib.error

url = 'https://eikiko-rbapp.hf.space/api/auth/change-password'
data = b'{"current_password":"123", "new_password":"123456"}'
headers = {'Content-Type': 'application/json'}

print("Iniciando monitoramento da API no Hugging Face...")
for _ in range(15): # tentar por 1 minuto e 15 segundos
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    try:
        urllib.request.urlopen(req)
        print("Endpoint /change-password respondeu com sucesso 200!")
        break
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print("404 Not Found - O endpoint ainda não existe no HF...")
        elif e.code == 503:
            print("503 Service Unavailable - Space reiniciando...")
        else:
            print(f"{e.code} {e.reason} - O endpoint existe! Retornou erro controlado do backend.")
            break
    except Exception as e:
        print(f"Erro ao conectar: {e}")
    
    time.sleep(5)
