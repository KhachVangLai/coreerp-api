import { registerAs } from '@nestjs/config';

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'change-me',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '1d',
  frontendOrigins: parseCsv(
    process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  ),
}));
