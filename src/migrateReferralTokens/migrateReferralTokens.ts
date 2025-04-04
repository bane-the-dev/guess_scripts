import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config()

const sql_old = postgres(process.env.OLD_PG_DATABASE_URL as string)
const sql_new = postgres(process.env.POSTGRES_URL as string)

async function migrateReferrals() {
  try {
    const referralTokens = await sql_old`
      SELECT 
        urt.id,
        urt.user_id AS old_user_id,
        w.new_user_id,
        urt.token,
        urt.limit,
        urt.is_active,
        urt.created_at
      FROM user_referral_token AS urt
      JOIN user_web_migration AS w
        ON urt.user_id = w.user_id
    `

    console.log(`Found ${referralTokens.length} referral tokens to migrate`)

    for (const rt of referralTokens) {
      await sql_new`
        INSERT INTO user_referral_token (
          user_id,
          token,
          "limit",
          is_active,
          created_at
        )
        VALUES (
          ${rt.new_user_id},
          ${rt.token},
          ${rt.limit},
          false,
          ${rt.created_at}
        )
      `
    }

    console.log('Referrals migrated successfully')
  } catch (error) {
    console.error('Error migrating referrals:', error)
    throw error
  }
}

async function main() {
  try {
    await migrateReferrals()
  } finally {
    // Close both database connections
    await sql_old.end()
    await sql_new.end()
  }
}

main()
