const ENDPOINT_URL = 'https://jocotheintern.ngrok.app/api/completeTask/claimTournamentReward?type=streak';
const COOKIES = 'privy-session=t; privy-token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IllHc3ZpMHlJVTJBZi1YSUc3RjN0YjRxX0RINENmbkcteHo3MHNNbEM3Zm8ifQ.eyJzaWQiOiJjbThvdmw2ZHgwMTY4bm94NTZkdzJzdHBmIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NDQxMDYyNDksImF1ZCI6ImNtM3lkaGtjbzAzN2hiZHA1MTZkdzlzdjMiLCJzdWIiOiJkaWQ6cHJpdnk6Y204bjUzNzI3MDAxdjdxNTNsbHI0NHcybCIsImV4cCI6MTc0NDEwOTg0OX0.Tj6pBZnsUg4xAFlqn1MZCQbBCyKLw7zpAaZP-uh2ORXG3MKTQP-8q-JmO9VWb7JXEixek4jsZdTSAYSgcftMEQ; privy-id-token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IllHc3ZpMHlJVTJBZi1YSUc3RjN0YjRxX0RINENmbkcteHo3MHNNbEM3Zm8ifQ.eyJjciI6IjE3NDI4MjUxMzgiLCJsaW5rZWRfYWNjb3VudHMiOiJbe1widHlwZVwiOlwidHdpdHRlcl9vYXV0aFwiLFwic3ViamVjdFwiOlwiMTQ2NDI0NTA2MTg5ODY3MDA4N1wiLFwidXNlcm5hbWVcIjpcImV4a2l6b2ZyZWFrXCIsXCJuYW1lXCI6XCJqb2NvXCIsXCJwZnBcIjpcImh0dHBzOi8vcGJzLnR3aW1nLmNvbS9wcm9maWxlX2ltYWdlcy8xODg5MzY1MzM1MDQ1ODA4MTI4L3h1MWt5TkdwX25vcm1hbC5qcGdcIixcImx2XCI6MTc0NDA0MTEyOX0se1widHlwZVwiOlwid2FsbGV0XCIsXCJhZGRyZXNzXCI6XCIweDhBYzlGOTg3NUVBYTQ1OTllYTc5Nzg3NDYzRWI3ZjBFY0Y0M0Q1YmZcIixcImNoYWluX3R5cGVcIjpcImV0aGVyZXVtXCIsXCJ3YWxsZXRfY2xpZW50X3R5cGVcIjpcInByaXZ5XCIsXCJsdlwiOjE3NDI4MjUxMzl9LHtcInR5cGVcIjpcIndhbGxldFwiLFwiYWRkcmVzc1wiOlwiN2dlc240WGFwcVYyZjJ0Nm1wOEtFaXBvalczanR2azE3eDZXMXluczJvZUdcIixcImNoYWluX3R5cGVcIjpcInNvbGFuYVwiLFwid2FsbGV0X2NsaWVudF90eXBlXCI6XCJwcml2eVwiLFwibHZcIjoxNzQyODI1MTM5fV0iLCJpc3MiOiJwcml2eS5pbyIsImlhdCI6MTc0NDEwNzY2OCwiYXVkIjoiY20zeWRoa2NvMDM3aGJkcDUxNmR3OXN2MyIsInN1YiI6ImRpZDpwcml2eTpjbThuNTM3MjcwMDF2N3E1M2xscjQ0dzJsIiwiZXhwIjoxNzQ0MTExMjY4fQ.0ZE-iWk5s7B9nqgzbt4nSfOJfPHfKjpYr_xl1NwhQlZUxqaE_O1dUpRSRUw7UxU1q0FR2jXJldTHZcxUtiU2aw';

async function testClaimTournament() {
  try {
    const response = await fetch(ENDPOINT_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': COOKIES
      },
      credentials: 'include'
    })

    // Log the response status and headers
    console.log('Response Status:', response.status)
    console.log('Response Headers:', response.headers)

    // Get the raw text first
    const responseText = await response.text()
    console.log('Raw response:', responseText)

    // Try to parse as JSON if possible
    let data
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      console.error('Failed to parse response as JSON:', e)
      return
    }

    if (!response.ok) {
      throw new Error(`Error: ${data.error}`)
    }

    console.log('Claim Tournament successful!')
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run multiple tests simultaneously
Promise.all([
  testClaimTournament(),
  testClaimTournament(),
  testClaimTournament()
]).then(() => {
  console.log('All claim tournament tests completed')
}).catch((error) => {
  console.error('One or more tests failed:', error)
})
