import express from "express";
import { prisma } from "../utils/prisma/index.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

//회원가입
router.post("/sign-up", async (req, res, next) => {
  const regex = /^[a-z0-9]+$/; //정규표현식 사용
  const passwordregex = /^.{6,}$/;
  
  try {
    const { userId, password, name, age } = req.body;
    const isUser = await prisma.User.findFirst({
      where: {
        userId,
      },
    });

    if (isUser)
      return res.status(409).json({ message: "이미 존재하는 아이디입니다." });

    if (!regex.test(userId))
      return res.status(409).json({ message: "유효하지 않은 아이디입니다." });

    if (!passwordregex.test(password))
      return res.status(409).json({ message: "유효하지 않은 비밀번호입니다." });

    if (!name || isNaN(age))
      return res.status(409).json({ message: "유효하지 않은 이름과 나이입니다." });

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.User.create({
      data: {
        userId: userId,
        password: hashedPassword,
        name: name,
        age: Number(age),
      },
    });

    return res.status(201).json({ message: "회원가입 성공" });
  } catch (err) {
    next(err);
  }
});

//로그인
router.post("/sign-in", async (req, res, next) => {
  try {
    const { userId, password } = req.body;
    const user = await prisma.User.findFirst({ where: { userId } });
    
    if (!user)
      return res.status(401).json({ message: "존재하지 않는 아이디입니다." });
    else if (!(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: "비밀번호가 일치하지 않습니다." });

    const accessToken = jwt.sign({ id: user.id }, JWT_SECRET, {
      expiresIn: "12h",
    });

    let refreshToken = user.refreshToken;
    if (!refreshToken ||jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err) => err)) {
      refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, {
        expiresIn: "7d",
      });
      await prisma.User.update({
        where: { id: user.id },
        data: { refreshToken: refreshToken },
      });
    }

    return res.status(200).json({ message: "로그인 성공", accessToken, refreshToken });
  } catch 
  {
    next(err);
  }
});

//토큰 갱신
router.post("/token", async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(401).json({ message: "리프레시 토큰이 필요합니다." });

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const user = await prisma.User.findFirst({
      where: { id: decoded.id, refreshToken },
    });
    if (!user)
      return res.status(401).json({ message: "유효하지 않은 리프레시 토큰입니다." });

    // 리프레시 토큰이 유효기간인지 확인
    jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err) => {
      if (err) {
        // 유효기간이 아니라면 재발급
        const newRefreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, {
          expiresIn: "7d",
        });
        await prisma.User.update({
          where: { id: user.id },
          data: { refreshToken: newRefreshToken },
        });
        refreshToken = newRefreshToken;
      }
    });

    const newAccessToken = jwt.sign({ id: user.id }, JWT_SECRET, {
      expiresIn: "12h",
    });

    return res.status(200).json({ accessToken: newAccessToken, refreshToken });
  } catch {
    return res.status(403).json({ message: "유효하지 않은 리프레시 토큰입니다." });
  }
});

export default router;
