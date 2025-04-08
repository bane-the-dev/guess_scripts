import postgres from 'postgres';
import 'dotenv/config';
import { fromUSDC, toUSDC } from '../utils/fixedPointConversion';

async function checkTournamentRewardDistribution(tournamentId: number) {
    // Initialize the database connection
    const sql = postgres(process.env.POSTGRES_URL as string);

    try {
        // Query for tournament USDC prize
        const tournamentPrize = await sql<[{ usdc_prize: bigint | null }]>`
            SELECT usdc_prize
            FROM tournaments
            WHERE id = ${tournamentId}
        `;

        // Query for total transactions in the tournament
        const totalTransactions = await sql<[{ transaction_count: number }]>`
            SELECT COUNT(*) AS transaction_count
            FROM streak_tournament_transactions
            WHERE tournament_id = ${tournamentId}
            AND user_transaction_id IS NOT NULL
        `;

        // Query for total players who played in the tournament
        const totalTournamentPlayers = await sql<[{ distinct_players: number }]>`
            SELECT COUNT(DISTINCT user_id) AS distinct_players
            FROM streak_tournament_transactions
            WHERE tournament_id = ${tournamentId}
            AND user_transaction_id IS NOT NULL
        `;

        // Query for total players with rewards
        const totalPlayers = await sql<[{ player_count: number }]>`
            SELECT COUNT(DISTINCT user_id) AS player_count
            FROM tournaments_reward_distribution
            WHERE tournament_id = ${tournamentId}
        `;

        // Query for players with 2M reward
        const twoMillionPlayers = await sql<[{ player_count: number }]>`
            SELECT COUNT(DISTINCT user_id) AS player_count
            FROM tournaments_reward_distribution
            WHERE tournament_id = ${tournamentId}
            AND reward = 2000000
        `;

        // Query for players with 3M reward
        const threeMillionPlayers = await sql<[{ player_count: number }]>`
            SELECT COUNT(DISTINCT user_id) AS player_count
            FROM tournaments_reward_distribution
            WHERE tournament_id = ${tournamentId}
            AND reward = 3000000
        `;

        // Query for players with more than 3M reward
        const moreThanThreeMillionPlayers = await sql<[{ player_count: number }]>`
            SELECT COUNT(DISTINCT user_id) AS player_count
            FROM tournaments_reward_distribution
            WHERE tournament_id = ${tournamentId}
            AND reward > 3000000
        `;

        // Query for total distributed rewards
        const totalDistributedRewards = await sql<[{ total_rewards: bigint }]>`
            SELECT SUM(reward) as total_rewards
            FROM tournaments_reward_distribution
            WHERE tournament_id = ${tournamentId}
        `;

        // Query for top 10 players by reward
        const topPlayers = await sql<Array<{ username: string, reward: bigint }>>`
            SELECT u.username, trd.reward
            FROM tournaments_reward_distribution trd
            JOIN users u ON u.id = trd.user_id
            WHERE trd.tournament_id = ${tournamentId}
            ORDER BY trd.reward DESC
            LIMIT 10
        `;

        // Log the results
        console.log('------- Streak Tournament Distribution Analysis -------');
        
        console.log(`Tournament USDC Prize Pool: ${fromUSDC(Number(tournamentPrize[0]?.usdc_prize ?? 0))}$`);
        console.log(`Total transactions: ${totalTransactions[0].transaction_count}`);
        const expectedPrize = computeTotalPrize(totalTransactions[0].transaction_count, Number(tournamentPrize[0]?.usdc_prize ?? 0));
        console.log(`Total expected prize pool: ${fromUSDC(expectedPrize)}$`);
        console.log(`Total actual distributed rewards: ${fromUSDC(Number(totalDistributedRewards[0]?.total_rewards ?? 0))}$`);
        console.log("--------------- IMPORTANT (should be 0) ---------------");
        console.log(`Difference (expected - actual): ${fromUSDC(expectedPrize - Number(totalDistributedRewards[0]?.total_rewards ?? 0))}$`);
        console.log("-------------------------------------------------------");
        console.log(`Total players who played: ${totalTournamentPlayers[0].distinct_players}`);
        console.log(`Total players with rewards: ${totalPlayers[0].player_count}`);
        console.log(`Players with 2$ reward: ${twoMillionPlayers[0].player_count}`);
        console.log(`Players with 3$ reward: ${threeMillionPlayers[0].player_count}`);
        console.log(`Players with >3$ reward: ${moreThanThreeMillionPlayers[0].player_count}`);
        
        console.log('\n-------- Top 10 Players by Reward --------');
        topPlayers.forEach((player, index) => {
            console.log(`${index + 1}. ${player.username}: ${fromUSDC(Number(player.reward))}$`);
        });
        console.log('--------------------------------');

        // Close the database connection
        await sql.end();
    } catch (error) {
        console.error('Error executing queries:', error);
        await sql.end();
        throw error;
    }
}

// Execute the function if run directly
if (require.main === module) {
    const tournamentId = process.argv[2] ? parseInt(process.argv[2]) : null;
    
    if (!tournamentId) {
        console.error('Please provide a tournament ID as a command line argument');
        process.exit(1);
    }

    checkTournamentRewardDistribution(tournamentId)
        .catch(error => {
            console.error('Error:', error);
            process.exit(1);
        });
}

/**
 * Computes the expected total prize pool
 * @param totalTransactions The total number of transactions
 * @param usdcPrizePool The existing USDC prize pool (in USDC fixed-point format)
 * @returns The total prize pool in USDC fixed-point format
 */
function computeTotalPrize(totalTransactions: number, usdcPrizePool: number): number {
    // Convert 0.9 to USDC fixed point (900000) and multiply by transactions
    const transactionsPrize = toUSDC(0.9 * totalTransactions);
    
    // Add the existing prize pool (already in USDC fixed point)
    return transactionsPrize + usdcPrizePool;
}

export default checkTournamentRewardDistribution;