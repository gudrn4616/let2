import winston from 'winston'

const logger = winston.createLogger({
    level: 'info',//error, warn, debug
    format: winston.format.json(),//어떻게 출력할것인지 정해줌
    transports:[
        new winston.transports.Console(),
    ]
})

export default function (req,res,next){
    const start =new Date().getTime();

    res.on('finish',()=>{
        const duration = new Date().getTime() - start;
        logger.info(`Method: ${req.method}, URL: ${req.url}, Duration: ${duration}ms`)
    })
    next();
}