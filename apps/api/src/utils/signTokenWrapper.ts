// a jwt.sign() function wrapper that returns a promise

import jwt, { type JwtPayload } from 'jsonwebtoken';

interface AuthPayload {
    email: string;
    role: "ADMIN" | "DOCTOR" | "PATIENT";
}

export async function signtoken(
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

export async function verifyToken<AuthPayload>(
    token: string,
    secretOrPublicKey: jwt.Secret,
    options?: jwt.VerifyOptions
): Promise<AuthPayload | JwtPayload> {
    return new Promise((resolve, reject) => {
        jwt.verify(
            token,
            secretOrPublicKey,
            options ?? {},
            (err, decoded) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!decoded || typeof decoded === "string") {
                    reject(new Error("Invalid JWT payload"));
                    return;
                }

                resolve(decoded);
            }
        );
    });
}