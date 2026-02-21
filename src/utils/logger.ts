import bunyan from 'bunyan';

const logger = bunyan.createLogger({
    name: 'rodex',
    level: 'warn',
    streams: [
        {
            level: 'debug',
            stream: process.stdout,
        },
    ],
});

export default logger;
