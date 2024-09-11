export default function (err,req,res,next){
    console.error(err);

    res.status(500).json({message: err.message ?? '서버 내부에서 에러가 발생하였습니다.'})
}