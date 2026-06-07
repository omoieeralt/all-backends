# Use the slim Debian-based Node image instead of Alpine.
# This often bypasses strange Docker Hub metadata errors on platforms like SnapDeploy!
FROM node:20-slim

# Create and set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first
# This allows Docker to cache the npm install step if your dependencies haven't changed
COPY package*.json ./

# Install dependencies (only production ones, ignoring dev dependencies)
RUN npm install --production

# Copy the rest of your application code (server.js, etc.)
COPY . .

# Expose the port that your app runs on
EXPOSE 3000

# Command to run your application
CMD [ "npm", "start" ]
