import postgres from 'postgres';
import 'dotenv/config';
import { fromUSDC } from '../utils/fixedPointConversion';

async function checkPvpTournamentRewardDistribution(tournamentId: number) {
    // Initialize the database connection
    const sql = postgres(process.env.POSTGRES_URL as string);

    try {
        // Query for tournament USDC prize
        const tournamentPrize = await sql<[{ usdc_prize: bigint | null }]>`
            SELECT usdc_prize
            FROM tournaments
            WHERE id = ${tournamentId}
        `;

        // Query for total players with rewards
        const totalPlayers = await sql<[{ player_count: number }]>`
            SELECT COUNT(DISTINCT user_id) AS player_count
            FROM tournaments_reward_distribution
            WHERE tournament_id = ${tournamentId}
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
        console.log('------- PVP Tournament Distribution Analysis -------');
        console.log(`Tournament USDC Prize Pool: ${fromUSDC(Number(tournamentPrize[0]?.usdc_prize ?? 0))}$`);
        console.log(`Total players rewarded: ${totalPlayers[0].player_count}`);
        console.log(`Total distributed rewards: ${fromUSDC(Number(totalDistributedRewards[0]?.total_rewards ?? 0))}$`);
        console.log('\n-------- Top 10 Players by Reward --------');
        topPlayers.forEach((player, index) => {
            console.log(`${index + 1}. ${player.username}: ${fromUSDC(Number(player.reward))}$`);
        });
        console.log('------------------------------------------------');

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

    checkPvpTournamentRewardDistribution(tournamentId)
        .catch(error => {
            console.error('Error:', error);
            process.exit(1);
        });
}

export default checkPvpTournamentRewardDistribution;
