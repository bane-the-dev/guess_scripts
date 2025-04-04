import { sql } from '@vercel/postgres'
import dotenv from 'dotenv';
dotenv.config()


const REFERRAL_CANDIES_MULTIPLIER_FIRST_LEVEL = 0.09
const REFERRAL_CANDIES_MULTIPLIER_SECOND_LEVEL = 0.02

const REFERRAL_KOL_CANDIES_MULTIPLIER_FIRST_LEVEL = 0.135
const REFERRAL_KOL_CANDIES_MULTIPLIER_SECOND_LEVEL = 0.03

// Provided function to compute unredeemed referral candies for a given user
export async function calculateUnredeemedReferralCandies(userId) {
  const [
    { rows: referralData },
    { rows: referralStats },
    { rows: redeemedCandies },
    { rows: userBalance },
  ] = await Promise.all([
    sql`
      WITH user_referral AS (
        SELECT urt.type as referral_token_type,
               urtr.user_id
          FROM user_referral_token_redeem urtr
          JOIN user_referral_token urt 
            ON urt.id = urtr.user_referral_token_id
         WHERE urtr.user_id = ${userId}
      )
      SELECT referral_token_type
        FROM user_referral
    `,
    sql`
      SELECT total_candies_in_first_circle,
             total_candies_redeemed_by_first_circle,
             total_candies_in_second_circle,
             total_candies_redeemed_by_second_circle
        FROM user_referral_overall_view
       WHERE user_id = ${userId}
    `,
    sql`
      SELECT COALESCE(SUM(amount), 0) as total_redeemed
        FROM user_referral_candies_redeemed
       WHERE user_id = ${userId}
    `,
    sql`
      SELECT total_amount
        FROM user_balances_assets
       WHERE user_id = ${userId}
         AND asset_id = 0
    `
  ])

  const isKol = referralData[0]?.referral_token_type === 'kol'
  const stats = referralStats[0] || {
    total_candies_in_first_circle: 0,
    total_candies_redeemed_by_first_circle: 0,
    total_candies_in_second_circle: 0,
    total_candies_redeemed_by_second_circle: 0,
  }

  const firstCircleCandies =
    stats.total_candies_in_first_circle -
    stats.total_candies_redeemed_by_first_circle
  const secondCircleCandies =
    stats.total_candies_in_second_circle -
    stats.total_candies_redeemed_by_second_circle
  const alreadyRedeemedCandies = redeemedCandies[0]?.total_redeemed || 0

  const totalEarnings =
    firstCircleCandies *
      (isKol
        ? REFERRAL_KOL_CANDIES_MULTIPLIER_FIRST_LEVEL
        : REFERRAL_CANDIES_MULTIPLIER_FIRST_LEVEL) +
    secondCircleCandies *
      (isKol
        ? REFERRAL_KOL_CANDIES_MULTIPLIER_SECOND_LEVEL
        : REFERRAL_CANDIES_MULTIPLIER_SECOND_LEVEL)

  const unredeemedCandies = totalEarnings - alreadyRedeemedCandies

  if (Number(userBalance[0]?.total_amount) + Number(unredeemedCandies) < 0) {
    const amountToRemove = totalEarnings - userBalance[0]?.total_amount
    console.log("user balance is too small to remove excess candies, only removing "+ amountToRemove+ " and keeping "+totalEarnings)
    return Math.floor(amountToRemove)
  }

  

  return Math.floor(unredeemedCandies)
}

// Update the insertNegativeTransaction function
async function insertNegativeTransaction(userId: string, amount: number) {
  try {
    // Insert into user_transactions and get the transaction_id
    const { rows: transaction } = await sql`
      INSERT INTO user_transactions (user_id, amount, asset_id)
      VALUES (${userId}, ${amount}, 0)
      RETURNING id
    `
    const transactionId = transaction[0]?.id

    if (transactionId) {
      // Insert into user_referral_candies_redeemed with the transaction_id
      await sql`
        INSERT INTO user_referral_candies_redeemed (user_id, amount, transaction_id)
        VALUES (${userId}, ${amount}, ${transactionId})
      `
      console.log(`Inserted negative transaction for user ${userId} with amount ${amount}, asset_id 0, and transaction_id ${transactionId}`)
    }
  } catch (error) {
    console.error(`Error inserting negative transaction for user ${userId}:`, error)
  }
}

// Modify the computeUnredeemedCandiesForAllUsers function
async function computeUnredeemedCandiesForAllUsers() {
  try {
    console.log("process.env.POSTGRES_URL", process.env.POSTGRES_URL)

    // Fetch all user ids from the users table
    const { rows: users } = await sql`SELECT u.*
      FROM users u`
    
    if (!users || users.length === 0) {
      console.log("No users found in the database.")
      return []
    }

    const batchSize = 10
    const results = []

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize)
      const batchResults = await Promise.all(batch.map(async (user) => {
        const unredeemedCandies = await calculateUnredeemedReferralCandies(user.id)
        
        // Add this new block to handle negative candies
        if (unredeemedCandies < 0) {
          await insertNegativeTransaction(user.id, unredeemedCandies)
        }

        return {
          userId: user.id,
          unredeemedCandies,
        }
      }))
      results.push(...batchResults)

      // Print the results of the current batch
      console.log('Batch results:', batchResults)
    }

    return results
  } catch (error) {
    console.error('Error fetching users:', error)
    return []
  }
}

// Execute the script and log the results
computeUnredeemedCandiesForAllUsers()
  .then((results) => {
    console.log('Unredeemed Referral Candies for each user:')
    console.table(results)
  })
  .catch((error) => {
    console.error('Error computing unredeemed referral candies:', error)
  })
