FROM node:18

WORKDIR /usr/src/app
COPY package.json yarn.lock ./
RUN yarn
COPY . .
EXPOSE 3001

# Command to run the application
CMD ["node", "src/index.js"]