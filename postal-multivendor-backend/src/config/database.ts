
import mongoose from 'mongoose';
import config from './index';

class Database {
  private static instance: Database;

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async connect(): Promise<void> {
    try {
      const options: mongoose.ConnectOptions = {
        dbName: config.mongodb.dbName,

        // Connection Pool
        maxPoolSize: Math.max(
          1,
          parseInt(process.env.MONGODB_MAX_POOL_SIZE || '50', 10)
        ),
        minPoolSize: 5,

        // Connection timeout
        serverSelectionTimeoutMS: 10000,

        // Authentication
        ...(config.mongodb.user &&
          config.mongodb.password && {
            auth: {
              username: config.mongodb.user,
              password: config.mongodb.password,
            },
          }),
      };

      await mongoose.connect(config.mongodb.uri, options);

      mongoose.connection.on('connected', () => {
        console.log('✅ MongoDB connected successfully');
      });

      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB disconnected');
      });

    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

export default Database.getInstance();
