import express from "express";
import cookieParser from "cookie-parser";
import expressSession from "express-session";
import expressMySQLSession from "express-mysql-session";
import dotenv from "dotenv";
import ErrorHandlingMiddleware from './middlewares/error-handling.middleware.js';
import UsersRouter from './routes/users.router.js';
import CharacterRouter from './routes/Character.router.js';
import ItemRouter from './routes/Item.router.js';
import AuthMiddleware from './middlewares/auth.middleware.js';

dotenv.config();
const app = express();
const port = 3000; // 포트 설정

app.use(express.json());

app.use('/game', [UsersRouter, CharacterRouter, ItemRouter]); 
app.use(ErrorHandlingMiddleware);

app.listen(port, () => {
  console.log(port, "포트로 서버가 열렸어요!");
});
