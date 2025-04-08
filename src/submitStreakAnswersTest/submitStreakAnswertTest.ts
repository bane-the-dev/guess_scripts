async function testSubmitStreakAnswer() {
  // Test parameters
  const testData = {
    answer: false,
    id: 1994,
    gameId: 637,
    tournamentId: 76
  }

  // Privy authentication cookies
  const privyIdToken = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IllHc3ZpMHlJVTJBZi1YSUc3RjN0YjRxX0RINENmbkcteHo3MHNNbEM3Zm8ifQ.eyJjciI6IjE3Mzg2Njc1NjQiLCJsaW5rZWRfYWNjb3VudHMiOiJbe1widHlwZVwiOlwidHdpdHRlcl9vYXV0aFwiLFwic3ViamVjdFwiOlwiMTc1ODYxMzIxNTc1NDIwMzEzN1wiLFwidXNlcm5hbWVcIjpcImJhbmV0aGVkZXZcIixcIm5hbWVcIjpcImJhbmUgdGhlIGRldlwiLFwicGZwXCI6XCJodHRwczovL3Bicy50d2ltZy5jb20vcHJvZmlsZV9pbWFnZXMvMTc3NTk3NjMzODEyNzU2MDcwNC9zWGQ1ZzN0LV9ub3JtYWwuanBnXCIsXCJsdlwiOjE3NDM3OTY0NDl9LHtcInR5cGVcIjpcIndhbGxldFwiLFwiYWRkcmVzc1wiOlwiMHgwZmMyMWVCRUJGMGQ5Q2JCMDUwMjIxOTljM2YzN2JDNkI2RDI3RUNDXCIsXCJjaGFpbl90eXBlXCI6XCJldGhlcmV1bVwiLFwid2FsbGV0X2NsaWVudF90eXBlXCI6XCJwcml2eVwiLFwibHZcIjoxNzM4NjY3NTY1fSx7XCJ0eXBlXCI6XCJ3YWxsZXRcIixcImFkZHJlc3NcIjpcIkVjdjhES1RrY0ZvSFh5dXdMdGFiM0tYWUJrUzlFMUVZV1BSTEtiNjhvSFFIXCIsXCJjaGFpbl90eXBlXCI6XCJzb2xhbmFcIixcIndhbGxldF9jbGllbnRfdHlwZVwiOlwicHJpdnlcIixcImx2XCI6MTczODY2NzU2NX1dIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NDM4NTU0NjUsImF1ZCI6ImNtM3lkaGtjbzAzN2hiZHA1MTZkdzlzdjMiLCJzdWIiOiJkaWQ6cHJpdnk6Y202cWRyeXRhMDA0aWNreGFkZDlrb2N2ZSIsImV4cCI6MTc0Mzg1OTA2NX0.5gL63v2aB41FKYVqONY_2Rl0iH4tdH66QHZDDTLrvqpMxC3TccY_-KbstkyQGmPHXRQiECg2Q0R_5bDesHD3MQ'
  const privySession = 't'
  const privyToken = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IllHc3ZpMHlJVTJBZi1YSUc3RjN0YjRxX0RINENmbkcteHo3MHNNbEM3Zm8ifQ.eyJzaWQiOiJjbTkzN2RzMGcwMWdsbDgwbDZhMjltOWNpIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NDM4NTU0NjAsImF1ZCI6ImNtM3lkaGtjbzAzN2hiZHA1MTZkdzlzdjMiLCJzdWIiOiJkaWQ6cHJpdnk6Y202cWRyeXRhMDA0aWNreGFkZDlrb2N2ZSIsImV4cCI6MTc0Mzg1OTA2MH0.Xk9TD71ES5S6X_yf528dMUvGMD5zY3yrBP5ziMh4EpcVA6e0i53V9sCDEbI6SQsml616YBVPJsTst2GO2mA5Gw'
  const endPoint = 'https://2a9976a846ad.ngrok.app/'
  const apiEndPoint = endPoint + 'api/claimFlufAirdrop'
  try {
    const response = await fetch(apiEndPoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `privy-id-token=${privyIdToken}; privy-session=${privySession}; privy-token=${privyToken}`
      },
      body: JSON.stringify(testData),
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
    
    console.log('Streak answer submission successful!')
    console.log('Response data:', data)
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run multiple tests simultaneously
Promise.all([
  testSubmitStreakAnswer(),
  testSubmitStreakAnswer(),
  testSubmitStreakAnswer()
]).then(() => {
  console.log('All streak answer submission tests completed')
}).catch((error) => {
  console.error('One or more tests failed:', error)
})