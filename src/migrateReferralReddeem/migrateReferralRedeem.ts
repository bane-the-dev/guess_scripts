import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config()

const sql_old = postgres(process.env.OLD_PG_DATABASE_URL as string)
const sql_new = postgres(process.env.POSTGRES_URL as string)

async function migrateReferralRedeems() {
    const oldRedeems = await sql_old`
        SELECT r.*, m.new_user_id, t.token, t.type, t.limit, t.expire_date, t.is_active
        FROM user_referral_token_redeem r
        INNER JOIN user_web_migration m ON r.user_id = m.user_id
        INNER JOIN user_referral_token t ON r.user_referral_token_id = t.id
        WHERE m.new_user_id IS NOT NULL
    `;

    console.log(`Found ${oldRedeems.length} redeems to migrate`);
    
    const tokenMapping = await sql_new`
        SELECT id, token 
        FROM user_referral_token 
        WHERE token IN ${sql_new(oldRedeems.map(r => r.token))}
    `;

    // Create a map for easier token lookup
    const tokenLookup = new Map(tokenMapping.map(t => [t.token, t.id]));

    // Prepare the new redeem records
    const newRedeems = oldRedeems.map(redeem => ({
        user_id: redeem.new_user_id,
        user_referral_token_id: tokenLookup.get(redeem.token),
        created_at: redeem.created_at
    })).filter(redeem => redeem.user_referral_token_id !== undefined);

    console.log(`Prepared ${newRedeems.length} records for insertion`);
    console.log('Sample new records:', newRedeems.slice(0, 3));

    // Insert the new records
    const insertedRedeems = await sql_new`
        INSERT INTO user_referral_token_redeem ${sql_new(newRedeems)}
        RETURNING id
    `;

    console.log(`Successfully inserted ${insertedRedeems.length} records`);
}

async function main() {
  await migrateReferralRedeems()
}

main()
