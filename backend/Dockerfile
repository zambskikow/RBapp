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
    && rm -rf /var/lib/apt/lists/*

# Copiar apenas o requirements primeiro para aproveitar o cache do Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar o restante do código do backend
# Note: no Hugging Face, se você subir a pasta 'backend', o Dockerfile deve estar nela.
COPY . .

# O Hugging Face Spaces usa a porta 7860 por padrão
EXPOSE 7860

# Comando para rodar a aplicação
# Ajustamos o host para 0.0.0.0 para aceitar conexões externas dentro do container
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "7860"]
