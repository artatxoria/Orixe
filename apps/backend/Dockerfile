FROM node:18-slim

WORKDIR /app

# Copiamos archivos de dependencias
COPY package*.json ./

RUN npm install

# Copiamos el resto del código
COPY . .

EXPOSE 3000

# Usaremos un script de desarrollo con hot-reload más adelante
CMD ["npm", "run", "dev"]