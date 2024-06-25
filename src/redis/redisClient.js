const redis = require("redis");

class RedisClient {
  constructor() {
    this.client = redis.createClient({
        URL: process.env.REDIS_URL || "redis://localhost:6379",
    });
    this.client.on("error", (error) => console.error(`Redis Client Error: ${error}`));
    this.client.on("connect", () => console.log("Connected to Redis!"));
    this.client.connect();
  }


  async  setUser(id, userObject) {
    const userKey = `user:${id}`;
    let currentValue = await this.client.get(userKey);
    
    if (!currentValue) {
      currentValue = {}; 
    } else {
      currentValue = JSON.parse(currentValue); 
    }
  
  
    Object.assign(currentValue, userObject);
  
    await this.client.set(userKey, JSON.stringify(currentValue));
  }
  
  async  getUser(id) {
    const userData = await this.client.get(`user:${id}`);
    return userData ? JSON.parse(userData) : null;
  }
  
  async  deleteUser(id) {
    await this.client.del(`user:${id}`);
  }
  
  async  updateUserWithData(chatId, data) {
    const userKey = `user:${chatId}`;
    let user = await this.client.get(userKey);
    user = user ? JSON.parse(user) : { params: {} };  
  
  
    Object.assign(user.params, data);
  
    await this.client.set(userKey, JSON.stringify(user));
  }
  
  async  getUserData(id, paramName) {
    const userKey = `user:${id}`;
    let user = await this.client.get(userKey);
  
    if (!user) {
      console.log("Usuário não encontrado.");
      return null;  
    }
  
    user = JSON.parse(user); 
    if (user.params && user.params.hasOwnProperty(paramName)) {
      return user.params[paramName];  
    } else {
      console.log(`Parâmetro '${paramName}' não encontrado para o usuário.`);
      return null;  
    }
  }
  

}

module.exports = new RedisClient();