import jwt from 'jsonwebtoken';
import { prisma } from "../utils/prisma/index.js";
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

export default async function (req, res, next) {
  try {
    const authorization = req.headers.authorization;
    if (!authorization) {
      return res.status(401).json({ message: "토큰이 제공되지 않았습니다." });
    }
    const authorizationarr = authorization.split(' ');
    const token = authorizationarr[1]
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await prisma.User.findFirst({
      where: {
        id: decoded.id
      }
    });

    if (!user) {
      return res.status(401).json({ message: "사용자가 존재하지 않습니다." });
    }

    req.user = user; // 인증된 사용자 정보를 req.user에 저장
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "JWT 유효기한이 만료되었습니다." });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "JWT 검증에 실패했습니다." });
    }
    return res.status(401).json({ message: error.message ?? "비정상적인 요청입니다." });
  }
}
