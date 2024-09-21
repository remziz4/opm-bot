FROM node:18

# Install required dependencies for Puppeteer/Chromium
RUN apt-get update && apt-get install -y \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxss1 \
    xdg-utils \
    fonts-liberation

WORKDIR /usr/src/app
COPY package.json yarn.lock ./
RUN yarn
COPY . .

EXPOSE 3001

CMD ["node", "src/index.js"]
