import express from "express";
import { prisma } from "../utils/prisma/index.js";
import authMiddleware from "../middlewares/auth.middleware.js";
const router = express.Router();

const ItemTypes = [
  "상의",
  "하의",
  "무기",
  "신발",
  "반지",
  "목걸이",
  "귀걸이",
  "체력포션",
];

const validStats = ["STR", "DEX", "INT", "LUK", "ATK", "healAmount"];

// 아이템 생성 API
router.post("/item/create", async (req, res) => {
  const {
    itemCode,
    name,
    ItemType,
    stats = {},
    price,
  } = req.body;

  if (
    isNaN(itemCode) ||
    isNaN(price)
  ) {
    return res.status(400).json({ message: "아이템 코드와 가격은 숫자여야 합니다." });
  }
  if (!ItemTypes.includes(ItemType)) {
    return res
      .status(400)
      .json({ message: "유효하지 않은 아이템 타입입니다." });
  }

  // stats 필드 검증
  for (const key of Object.keys(stats)) {
    if (!validStats.includes(key)) {
      return res.status(400).json({ message: `유효하지 않은 스탯: ${key}` });
    }
  }

  try {
    // itemCode 중복 확인
    const existingItem = await prisma.item.findUnique({
      where: { itemCode },
    });

    if (existingItem) {
      return res.status(409).json({ message: "아이템 코드가 중복되었습니다." });
    }

    const newItem = await prisma.item.create({
      data: {
        itemCode,
        name,
        ItemType,
        stats,
        price,
      },
    });
    res.status(201).json(newItem);
  } catch {
    res.status(500).json({ message: "아이템 생성에 실패했습니다." });
  }
});

// 아이템 수정 API
router.put("/item/update/:itemCode", async (req, res) => {
  const { itemCode } = req.params;
  if (isNaN(itemCode)) {
    return res.status(404).json({ message: "아이템을 찾을 수 없습니다." });
  }
  const {
    name,
    stats = {},
  } = req.body;

  // stats 필드 검증
  for (const key of Object.keys(stats)) {
    if (!validStats.includes(key)) {
      return res.status(400).json({ message: `유효하지 않은 스탯: ${key}` });
    }
  }

  try {
    const isItem = await prisma.item.findUnique({
      where: { itemCode: +itemCode },
    });
    if (!isItem) {
      return res.status(404).json({ message: "아이템을 찾을 수 없습니다." });
    }
    const updatedItem = await prisma.item.update({
      where: { itemCode: +itemCode },
      data: {
        name,
        stats,
      },
    });
    res.status(200).json(updatedItem);
  } catch {
    res.status(500).json({ message: "아이템 수정에 실패했습니다." });
  }
});

// 아이템 목록 조회 API
router.get("/item/list", async (req, res) => {
  try {
    const items = await prisma.item.findMany({
      select: {
        itemCode: true,
        name: true,
        ItemType: true,
        price: true,
      },
    });
    res.status(200).json({ data: items });
  } catch {
    res.status(500).json({ message: "아이템 목록 조회에 실패했습니다." });
  }
});

// 아이템 상세 조회 API
router.get("/item/detail/:id", async (req, res) => {
  const { id } = req.params;
  if (isNaN(id)) {
    return res.status(400).json({ message: "유효하지 않은 코드입니다." });
  }
  try {
    const item = await prisma.item.findUnique({
      where: { itemCode: +id },
    });

    if (!item) throw new Error("아이템을 찾을 수 없습니다.");

    delete item.id;

    res.status(200).json({ data: item });
  } catch (error) {
    return res.status(500).json({ message: error.message ?? "아이템 상세 조회에 실패했습니다." });
  }
});

// 아이템 삭제 API
router.delete("/item/delete/:id", async (req, res) => {
  const { id } = req.params;
  if (isNaN(id)) {
    return res.status(400).json({ message: "유효하지 않은 코드입니다." });
  }
  try {
    const item = await prisma.item.findUnique({
      where: { itemCode: +id },
    });
    if (!item) {
      return res.status(404).json({ message: "아이템을 찾을 수 없습니다." });
    }
    await prisma.item.delete({
      where: { itemCode: +id },
    });
    res.status(200).json({ message: "아이템이 삭제되었습니다." });
  } catch {
    return res.status(500).json({ message: "아이템 삭제에 실패했습니다." });
  }
});

//아이템 구매
router.post("/item/buy/:charaterid", authMiddleware, async (req, res, next) => {
  const {charaterid} = req.params;
  const { id } = req.user;
  // req.body에서 아이템 목록을 받아와서 같은 itemcode를 가진 아이템들을 합치는 로직
  const items = req.body.reduce((arr, item) => {
    // 이미 같은 itemcode를 가진 아이템이 있는지 확인
    const sumItem = arr.find(i => i.itemcode === item.itemcode);
    if (sumItem) {
      // 같은 itemcode를 가진 아이템이 있으면 count를 증가시킴
      sumItem.count += item.count;
    } else {
      // 같은 itemcode를 가진 아이템이 없으면 새로운 아이템을 배열에 추가
      arr.push(item);
    }
    return arr;// acc 배열을 반환하여 다음 반복에서 사용
  }, []);

  try {
    let totalmoney = 0;
    
    const character = await prisma.character.findFirst({
      where: {
        id: +charaterid,
        userId: +id,
      },
      select: {
        id: true,
        money: true,
      }
    });
    
    if (!character) {
      return res.status(403).json({ message: "자신의 캐릭터가 아닙니다." });
    }
    for (const { itemcode, count } of items) {
      const item = await prisma.item.findUnique({
        where: {
          itemCode: +itemcode,
        },
        select: {
          price: true,
        },
      });
      if (!item) continue;
      totalmoney += item.price * count;
    }
    if (character.money < totalmoney) throw new Error("잔액이 부족합니다.");

    await prisma.$transaction(async (tx) => {
      await tx.character.update({
        where: {
          id: character.id,
        },
        data: {
          money: character.money - totalmoney
        }
      });

      for (const { itemcode, count } of items) {
        const item = await tx.item.findUnique({
          where: {
            itemCode: +itemcode,
          },
          select: {
            itemCode: true,
            name: true,
            ItemType: true,
            price: true,
            stats: true,
          },
        });

        if (!item) continue;

        const itemDetails = {
          itemCode: item.itemCode,
          name: item.name,
          ItemType: item.ItemType,
          price: item.price,
          count,
          stats: item.stats,
        };

        const inventoryItem = await tx.inventory.findFirst({
          where: {
            characterId: character.id,
          }
        });

        const updatedItems = [...inventoryItem.items];
        const Index = updatedItems.findIndex(i => i.itemCode === itemcode);

        if (Index !== -1) {
          updatedItems[Index].count += count;
        } else {
          updatedItems.push(itemDetails);
        }

        await tx.inventory.update({
          where: {
            id: inventoryItem.id
          },
          data: {
            items: updatedItems
          }
        });
      }
    });

    return res.status(200).json({ message: "아이템 구매에 성공하였습니다." });
  } catch(error) {
    return res.status(500).json({ message: error.message ?? "아이템 구매에 실패했습니다." });
  }
});

//인벤토리 조회
router.get("/item/inventorylist/:characterid", authMiddleware, async (req, res, next) => {
  const { characterid } = req.params;
  const { id } = req.user;
  console.log(characterid)
  if (isNaN(characterid)) {
    return res.status(400).json({ message: "유효하지 않은 입력입니다." });
  }

  try {
    const transaction = await prisma.$transaction(async (tx) => {
      const isCharacter = await tx.character.findFirst({
        where: {
          id: +characterid,
          userId: +id,
        },
      });

      if (!isCharacter) {
        throw new Error("자신의 캐릭터가 아닙니다.");
      }

      const inventory = await tx.inventory.findFirst({
        where: {
          characterId: +characterid,
        },
      });

      return res.status(200).json({ data: inventory.items });
    });

    return transaction;
  } catch (error) {
    return res.status(500).json({ message: error.message ?? "알 수 없는 오류가 발생했습니다." });
  }
});

//아이템 판매
router.post("/item/sale/:characterid", authMiddleware, async (req, res, next) => {
  const { characterid } = req.params;
  const { id } = req.user;

   // req.body에서 아이템 목록을 받아와서 같은 itemcode를 가진 아이템들을 합치는 로직
   const items = req.body.reduce((arr, item) => {
    // 이미 같은 itemcode를 가진 아이템이 있는지 확인
    const sumItem = arr.find(i => i.itemcode === item.itemcode);
    if (sumItem) {
      // 같은 itemcode를 가진 아이템이 있으면 count를 증가시킴
      sumItem.count += item.count;
    } else {
      // 같은 itemcode를 가진 아이템이 없으면 새로운 아이템을 배열에 추가
      arr.push(item);
    }
    return arr;// acc 배열을 반환하여 다음 반복에서 사용
  }, []);
  

  if (isNaN(characterid)) {
    return res.status(400).json({ message: "유효하지 않은 입력입니다." });
  }

  try {
    const transaction = await prisma.$transaction(async (tx) => {
      const isCharacter = await tx.character.findFirst({
        where: {
          id: +characterid,
          userId: +id,
        },
      });

      if (!isCharacter) throw new Error("자신의 캐릭터가 아닙니다." );

      const inventory = await tx.inventory.findFirst({
        where: {
          characterId: +characterid,
        },
        select: {
          id:true,
          items: true,
        },
      });

      //판매 수익 계산
      let totalmoney = isCharacter.money;
      for (const { itemcode, count } of items) {
        const inventoryItem = inventory.items.find((invItem) => invItem.itemCode === itemcode);
        if (!inventoryItem) {
          throw new Error("인벤토리에 없는 아이템이 있습니다.");
        }
        const item = await tx.item.findFirst({
          where: {
            itemCode: +itemcode,
          },
          select: {
            price: true,
          },
        });

        if (!item) {
          throw new Error("판매할 수 없는 아이템이 있습니다.");
        }
        if(inventoryItem.count<count){
          throw new Error("판매할 수 있는 양이 아닙니다.");
        }
        totalmoney += Math.floor(item.price * count * 0.6);
      }

      //인벤토리 업데이트
      let updateInventory = [...inventory.items];
      for (const { itemcode, count } of items) {
        const index = updateInventory.findIndex(i => i.itemCode === itemcode);
        updateInventory[index].count -= count;
        if (updateInventory[index].count === 0) {
          updateInventory.splice(index, 1);
        }
      }
      
      await tx.Inventory.update({
        where: {
          id:+inventory.id,
          characterId: +characterid },
        data: { items: updateInventory }
      });
      
      await tx.character.update({
        where: { id: +characterid },
        data: { money: totalmoney }
      });

      return res.status(200).json({ message: "아이템 판매에 성공하였습니다." });
    });

    return transaction;
  } catch (error) {
    return res.status(500).json({ message: error.message ?? "알 수 없는 오류가 발생했습니다." });
  }
});

export default router;
