// a jwt.sign() function wrapper that returns a promise

import jwt from 'jsonwebtoken';

export default function signtoken(
    payload: string | object | Buffer,
    secretOrPrivateKey: jwt.Secret,
    options?: jwt.SignOptions
): Promise<string> {
    return new Promise((resolve, reject) => {
        jwt.sign(payload, secretOrPrivateKey, options ?? {}, (err, token) => {
            if (err) {
                reject(err);
                return;
            }

            if (!token) {
                reject(new Error("JWT signing returned no token"));
                return;
            }

            resolve(token);
        });
    });
}