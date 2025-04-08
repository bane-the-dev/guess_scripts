async function testWithdrawUSDC() {
  // Test parameters
  const testData = {
    amount: 2560000, // Amount in USDC (e.g., 1 USDC = 1000000)
    withdrawAddress: 'HvvdDYXDrDNLamjeLyooY5sQnzLLfG9kqpj5hY6tT94A' // Replace with a valid Solana address
  }

  // Privy authentication cookies
  const privyIdToken = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IllHc3ZpMHlJVTJBZi1YSUc3RjN0YjRxX0RINENmbkcteHo3MHNNbEM3Zm8ifQ.eyJjciI6IjE3Mzg2Njc1NjQiLCJsaW5rZWRfYWNjb3VudHMiOiJbe1widHlwZVwiOlwidHdpdHRlcl9vYXV0aFwiLFwic3ViamVjdFwiOlwiMTc1ODYxMzIxNTc1NDIwMzEzN1wiLFwidXNlcm5hbWVcIjpcImJhbmV0aGVkZXZcIixcIm5hbWVcIjpcImJhbmUgdGhlIGRldlwiLFwicGZwXCI6XCJodHRwczovL3Bicy50d2ltZy5jb20vcHJvZmlsZV9pbWFnZXMvMTc3NTk3NjMzODEyNzU2MDcwNC9zWGQ1ZzN0LV9ub3JtYWwuanBnXCIsXCJsdlwiOjE3NDM3OTY0NDl9LHtcInR5cGVcIjpcIndhbGxldFwiLFwiYWRkcmVzc1wiOlwiMHgwZmMyMWVCRUJGMGQ5Q2JCMDUwMjIxOTljM2YzN2JDNkI2RDI3RUNDXCIsXCJjaGFpbl90eXBlXCI6XCJldGhlcmV1bVwiLFwid2FsbGV0X2NsaWVudF90eXBlXCI6XCJwcml2eVwiLFwibHZcIjoxNzM4NjY3NTY1fSx7XCJ0eXBlXCI6XCJ3YWxsZXRcIixcImFkZHJlc3NcIjpcIkVjdjhES1RrY0ZvSFh5dXdMdGFiM0tYWUJrUzlFMUVZV1BSTEtiNjhvSFFIXCIsXCJjaGFpbl90eXBlXCI6XCJzb2xhbmFcIixcIndhbGxldF9jbGllbnRfdHlwZVwiOlwicHJpdnlcIixcImx2XCI6MTczODY2NzU2NX1dIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NDM4NzIzNjgsImF1ZCI6ImNtM3lkaGtjbzAzN2hiZHA1MTZkdzlzdjMiLCJzdWIiOiJkaWQ6cHJpdnk6Y202cWRyeXRhMDA0aWNreGFkZDlrb2N2ZSIsImV4cCI6MTc0Mzg3NTk2OH0.6He14WcWvNk8WtT_zgZAR9lkyufjh4ih-aN--_oEGn8U7ta86DcuOksUGmRVLd_o-b2Qbr_BEEBfYkXJPa8b_Q'
  const privySession = 't'
  const privyToken = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IllHc3ZpMHlJVTJBZi1YSUc3RjN0YjRxX0RINENmbkcteHo3MHNNbEM3Zm8ifQ.eyJzaWQiOiJjbTkzNDFwa3EwMW5hbDQwa2tqZnJyNW1oIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NDM4NzIxODEsImF1ZCI6ImNtM3lkaGtjbzAzN2hiZHA1MTZkdzlzdjMiLCJzdWIiOiJkaWQ6cHJpdnk6Y202cWRyeXRhMDA0aWNreGFkZDlrb2N2ZSIsImV4cCI6MTc0Mzg3NTc4MX0.Lk7m-vhj4lhZaLMqhV5CzpgAfbf1Rngyv7dZqJZaaoFfp03WQfhPmwALYkzBLSH2zPSXbMtp0yEoTASRlNZLrg'
  
  try {
    const response = await fetch('http://localhost:3000/api/withdrawUSDC', {
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
    
    console.log('Withdrawal successful!')
    console.log('Signature:', data.signature)
    console.log('Transfer Amount:', data.transferAmount)
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run multiple tests simultaneously
Promise.all([
  testWithdrawUSDC(),
  testWithdrawUSDC(),
  testWithdrawUSDC()
]).then(() => {
  console.log('All withdrawal tests completed')
}).catch((error) => {
  console.error('One or more tests failed:', error)
})
