import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config()

const sql = postgres(process.env.POSTGRES_URL as string)

async function createReferralCodesForAllUsers() {
  try {
    // Get all users without active referral tokens
    const users = await sql`
      SELECT u.*
      FROM users u
      LEFT JOIN user_referral_token urt ON u.id = urt.user_id AND urt.is_active = true
      WHERE urt.user_id IS NULL
      AND u.is_bot = false
    `

    console.log(`Found ${users.length} users who need referral codes`)

    // Default limit for referrals
    const DEFAULT_LIMIT = 5

    // Create a referral code for each user
    for (const user of users) {
      // Since we're only getting users without active tokens, we can skip the check
      let tokenInserted = false;
      let attempts = 0;
      const MAX_ATTEMPTS = 5;
      
      // Try to insert a token, handling potential collisions
      while (!tokenInserted && attempts < MAX_ATTEMPTS) {
        attempts++;
        // Generate a random 5-character alphanumeric token
        const token = generateRandomToken(5);
        
        try {
          // Insert new referral token
          await sql`
            INSERT INTO user_referral_token (
              user_id,
              token,
              "limit",
              is_active,
              type,
              created_at
            )
            VALUES (
              ${user.id},
              ${token},
              ${DEFAULT_LIMIT},
              true,
              'normal',
              now()
            )
          `;
          console.log(`Created referral token for user ${user.id}: ${token}`);
          tokenInserted = true;
        } catch (error) {
          // Check if error is due to token collision (unique constraint violation)
          if (error instanceof Error && error.message.includes('unique constraint') && attempts < MAX_ATTEMPTS) {
            console.log(`Token collision for ${token}, retrying...`);
          } else {
            console.error(`Failed to create token for user ${user.id} after ${attempts} attempts:`, error);
            throw error;
          }
        }
      }
      
      if (!tokenInserted) {
        console.error(`Could not generate unique token for user ${user.id} after ${MAX_ATTEMPTS} attempts`);
      }
    }

    console.log('Referral codes created successfully');
  } catch (error) {
    console.error('Error creating referral codes:', error);
    throw error;
  }
}

// Function to generate a random alphanumeric token of specified length
function generateRandomToken(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

async function main() {
  try {
    await createReferralCodesForAllUsers()
  } finally {
    // Close database connection
    await sql.end()
  }
}

main()
