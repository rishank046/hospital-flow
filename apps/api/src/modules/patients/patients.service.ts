import pool from "#database/pool.js";
export function getMyProfileService(email : string){
    const result = pool.query("SELECT name, email , created_at FROM users WHERE email = $1", [email]);
    return result;
}