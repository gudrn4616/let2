import express from "express";
import { prisma } from "../utils/prisma/index.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

const router = express.Router();

const ItemTypes = [
  "모자",
  "상의",
  "하의",
  "무기",
  "신발",
  "반지",
  "목걸이",
  "귀걸이",
  "체력포션",
];

dotenv.config();

//캐릭터 생성
router.post("/CharacterCreate", authMiddleware, async (req, res, next) => {
  const { id } = req.user; 
  const { name } = req.body;

  try {
    const transaction = await prisma.$transaction(async (tx) => {
      const isCharacter = await tx.Character.findFirst({
        where: {
          name,
        },
      });
      if (isCharacter)
        throw new Error("이미 닉네임이 존재합니다.");

      const Character = await tx.Character.create({
        data: {
          name: name,
          userId: id,
        },
      });

      const Inventory = await tx.Inventory.create({
        data: {
          characterId: Character.id,
          items: [],
        },
      });

      const Equipment = await tx.CharacterItem.create({
        data: {
          characterId: Character.id,
          equippedItems: [],
        },
      });

      return res.status(201).json({ data: { Character, Inventory, Equipment } });
    });

    return transaction;
  } catch (error) {
    next(error);
  }
});

//캐릭터 삭제
router.post("/CharacterDelete/:id", authMiddleware, async (req, res, next) => {
  const { id } = req.user;
  const characterId = req.params.id;

  if (isNaN(characterId)) {
    return res.status(409).json({ message: "입력이 잘못되었습니다." });
  }
  characterId = +characterId;
  try {
    const transaction = await prisma.$transaction(async (tx) => {
      const character = await tx.Character.findFirst({
        where: {
          id: characterId,
          userId: id,
        },
      });
      if (!character) throw new Error("캐릭터를 찾을 수 없습니다.");

      await tx.Character.delete({
        where: {
          id: characterId,
        },
      });
      return res.status(200).json({ message: "캐릭터가 삭제되었습니다." });
    });

    return transaction;
  } catch (error) {
    next(error);
  }
});

//캐릭터 상세 조회
router.get("/check/:id", async (req, res, next) => {
  const authorizationarr = req.headers.authorization.split(" ");
  const token = authorizationarr[1];
  const characterId = req.params.id;
  if (isNaN(characterId)) {
    return res.status(409).json({ message: "입력이 잘못되었습니다." });
  }
  if (!token) {
    const characterCheck = await prisma.Character.findFirst({
      where: {
        id: +characterId,
      },
      select: {
        name: true,
        health: true,
        ATK: true,
      },
    });
    if (!characterCheck) {
      return res.status(404).json({ message: "캐릭터를 찾을 수 없습니다." });
    }
    return res.status(200).json({ data: characterCheck });
  } else {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const characterCheck = await prisma.Character.findFirst({
        where: {
          id: +characterId,
        },
        select: {
          name: true,
          health: true,
          ATK: true,
          money: true,
          userId: true,
        },
      });

      if (!characterCheck)
        return res.status(404).json({ message: "캐릭터를 찾을 수 없습니다." });

      if (characterCheck.userId !== decoded.id) delete characterCheck.money;

      delete characterCheck.userId;

      return res.status(200).json({ data: characterCheck });
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res
          .status(401)
          .json({ message: "JWT 유효기한이 만료되었습니다." });
      } else if (error.name === "JsonWebTokenError") {
        return res.status(401).json({ message: "JWT 검증에 실패했습니다." });
      }
      return res.status(401).json({ message: "토큰이 유효하지 않습니다." });
    }
  }
});

// 인벤토리 확인 API
router.get("/character/:characterId/inventory", async (req, res, next) => {
  const { characterId } = req.params;
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "토큰이 제공되지 않았습니다." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const character = await prisma.Character.findFirst({
      where: {
        id: +characterId,
      },
      select: {
        userId: true,
      },
    });

    if (!character) {
      return res.status(404).json({ message: "캐릭터를 찾을 수 없습니다." });
    }

    if (character.userId !== decoded.id) {
      return res.status(403).json({ message: "자신의 캐릭터가 아닙니다." });
    }

    const inventory = await prisma.Inventory.findFirst({
      where: {
        characterId: +characterId,
      },
      select: {
        items: true,
      },
    });

    if (!inventory) {
      return res.status(404).json({ message: "인벤토리를 찾을 수 없습니다." });
    }

    return res.status(200).json({ data: inventory.items });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "JWT 유효기한이 만료되었습니다." });
    } else if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "JWT 검증에 실패했습니다." });
    }
    next(error);
  }
});

// 캐릭터 장착 아이템 확인 API
router.get("/character/:characterId/equipped-items", async (req, res, next) => {
  const { characterId } = req.params;
  if (isNaN(characterId)) {
    return res.status(400).json({ message: "유효하지 않은 입력입니다." });
  }

  try {
    const character = await prisma.Character.findFirst({
      where: {
        id: +characterId,
      },
      select: {
        userId: true,
      },
    });

    if (!character) {
      throw new Error("캐릭터를 찾을 수 없습니다.");
    }

    const equippedItems = await prisma.CharacterItem.findFirst({
      where: {
        characterId: +characterId,
      },
      select: {
        equippedItems: true,
      },
    });

    if (!equippedItems) {
      throw new Error("장착된 아이템을 찾을 수 없습니다.");
    }

    return res.status(200).json({ data: equippedItems.equippedItems });
  } catch (error) {
    next(error);
  }
});

//캐릭터 아이템 장착
router.post("/character/:characterId/equip-item", authMiddleware, async (req, res, next) => {
  const { characterId } = req.params;
  const { itemCode } = req.body;
  const { id } = req.user;

  if (isNaN(characterId) || isNaN(itemCode)) {
    return res.status(400).json({ message: "유효하지 않은 입력입니다." });
  }

  try {
    const transaction = await prisma.$transaction(async (tx) => {
      const character = await tx.Character.findFirst({
        where: {
          id: +characterId,
          userId: id,
        },
      });

      if (!character) {
        throw new Error("캐릭터를 찾을 수 없습니다.");
      }

      const item = await tx.Item.findFirst({
        where: {
          itemCode: +itemCode,
        },
      });

      if (!item) {
        throw new Error("아이템을 찾을 수 없습니다.");
      }

      if (item.ItemType === "체력포션") {
        throw new Error("체력포션은 장착할 수 없습니다.");
      }

      const inventory = await tx.Inventory.findFirst({
        where: {
          characterId: +characterId,
        },
      });

      if (
        !inventory ||
        !inventory.items.some((i) => i.itemCode === item.itemCode)
      ) {
        throw new Error("아이템이 인벤토리에 없습니다.");
      }

      let characterItem = await tx.CharacterItem.findFirst({
        where: {
          characterId: +characterId,
        },
      });

      // characterItem이 null인 경우 새로 생성
      if (!characterItem) {
        characterItem = await tx.CharacterItem.create({
          data: {
            characterId: +characterId,
            equippedItems: [],
          },
        });
      }

      const itemTypeCount = characterItem.equippedItems.filter(
        (i) => i.ItemType === item.ItemType
      ).length;

      if (
        ["상의", "하의", "신발", "무기", "모자", "목걸이"].includes(
          item.ItemType
        ) &&
        itemTypeCount >= 1
      ) {
        throw new Error(`${item.ItemType}는 1개만 장착할 수 있습니다.`);
      }

      if (["반지", "귀걸이"].includes(item.ItemType) && itemTypeCount >= 2) {
        throw new Error(`${item.ItemType}는 2개만 장착할 수 있습니다.`);
      }

      characterItem.equippedItems.push(item);

      await tx.CharacterItem.update({
        where: {
          id: characterItem.id,
        },
        data: {
          equippedItems: characterItem.equippedItems,
        },
      });

      // 인벤토리에서 아이템 제거
      inventory.items = inventory.items.filter((i) => i.itemCode !== item.itemCode);

      await tx.Inventory.update({
        where: {
          id: inventory.id,
        },
        data: {
          items: inventory.items,
        },
      });

      const updatedStats = { ...character };
      for (const stat in item.stats) {
        updatedStats[stat] += item.stats[stat];
      }

      await tx.Character.update({
        where: {
          id: +characterId,
        },
        data: updatedStats,
      });

      return res.status(200).json({ message: "아이템 장착에 성공했습니다." });
    });

    return transaction;
  } catch (error) {
    next(error);
  }
});

// 아이템 탈착
router.post("/character/unequip/:characterId", authMiddleware, async (req, res, next) => {
  const { characterId } = req.params;
  const { itemCode } = req.body;
  const { id } = req.user;

  if (isNaN(characterId) || isNaN(itemCode)) {
    return res.status(400).json({ message: "유효하지 않은 입력입니다." });
  }

  try {
    const transaction = await prisma.$transaction(async (tx) => {
      const character = await tx.Character.findFirst({
        where: {
          id: +characterId,
          userId: id,
        },
      });

      if (!character) {
        throw new Error("자신의 캐릭터가 아닙니다.");
      }

      const characterItem = await tx.CharacterItem.findFirst({
        where: {
          characterId: +characterId,
        },
      });

      if (!characterItem) {
        throw new Error("장착된 아이템이 없습니다.");
      }

      const itemIndex = characterItem.equippedItems.findIndex(
        (i) => i.itemCode === itemCode
      );

      if (itemIndex === -1) {
        throw new Error("장착된 아이템이 아닙니다.");
      }

      const [item] = characterItem.equippedItems.splice(itemIndex, 1);

      await tx.CharacterItem.update({
        where: {
          id: characterItem.id,
        },
        data: {
          equippedItems: characterItem.equippedItems,
        },
      });

      const updatedStats = { ...character };
      for (const stat in item.stats) {
        updatedStats[stat] -= item.stats[stat];
      }

      await tx.Character.update({
        where: {
          id: +characterId,
        },
        data: updatedStats,
      });

      // 인벤토리에 아이템 추가
      const inventory = await tx.Inventory.findFirst({
        where: {
          characterId: +characterId,
        },
      });

      if (!inventory) {
        throw new Error("인벤토리를 찾을 수 없습니다.");
      }

      inventory.items.push(item);

      await tx.Inventory.update({
        where: {
          id: inventory.id,
        },
        data: {
          items: inventory.items,
        },
      });

      return res.status(200).json({ message: "아이템 탈착에 성공했습니다." });
    });

    return transaction;
  } catch (error) {
    next(error);
  }
});

// 캐릭터 돈버는 API
router.post("/earnMoney/:id", authMiddleware, async (req, res, next) => {
  const { id } = req.user;
  const characterId = req.params.id;

  if (isNaN(characterId)) {
    return res.status(409).json({ message: "입력이 잘못되었습니다." });
  }

  try {
    const character = await prisma.Character.findFirst({
      where: {
        id: +characterId,
        userId: id,
      },
    });

    if (!character) {
      return res.status(404).json({ message: "캐릭터를 찾을 수 없습니다." });
    }

    const earnedMoney = 10000; // 돈을 버는 양

    await prisma.Character.update({
      where: {
        id: +characterId,
      },
      data: {
        money: character.money + earnedMoney,
      },
    });

    return res.status(200).json({ message: "돈을 벌었습니다.", earnedMoney });
  } catch (error) {
    next(error);
  }
});




export default router;
