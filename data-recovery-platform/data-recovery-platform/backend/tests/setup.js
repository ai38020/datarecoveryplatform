// 测试环境设置
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.DB_NAME = 'test_db';

// 设置测试超时
jest.setTimeout(30000);

// 全局测试前设置
beforeAll(async () => {
  // 数据库初始化等操作
});

// 全局测试后清理
afterAll(async () => {
  // 清理操作
});

// 每个测试前的设置
beforeEach(() => {
  // 每个测试前的重置操作
});

// 每个测试后的清理
afterEach(() => {
  // 每个测试后的清理操作
});