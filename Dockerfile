# Usar imagem oficial do Python
FROM python:3.10-slim

# Evitar que o Python gere arquivos .pyc e garantir logs em tempo real
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Definir diretório de trabalho
WORKDIR /app

# Instalar dependências do sistema necessárias para algumas bibliotecas Python
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar apenas o requirements primeiro de dentro da pasta backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar o código do backend para a pasta /app do container
# Copiamos o CONTEÚDO da pasta backend para a raiz do container
COPY backend/ .

# O Hugging Face Spaces usa a porta 7860 por padrão
EXPOSE 7860

# Comando para rodar a aplicação
# O arquivo estará em /app/src/main.py
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "7860"]
