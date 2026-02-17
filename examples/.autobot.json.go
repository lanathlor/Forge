{
  "version": "1.0",
  "maxRetries": 3,
  "qaGates": [
    {
      "name": "Go Format",
      "enabled": true,
      "command": "gofmt -l .",
      "timeout": 30000,
      "failOnError": true,
      "order": 1
    },
    {
      "name": "Go Vet",
      "enabled": true,
      "command": "go vet ./...",
      "timeout": 60000,
      "failOnError": true,
      "order": 2
    },
    {
      "name": "golangci-lint",
      "enabled": true,
      "command": "golangci-lint run",
      "timeout": 120000,
      "failOnError": true,
      "order": 3
    },
    {
      "name": "Go Test",
      "enabled": true,
      "command": "go test ./...",
      "timeout": 300000,
      "failOnError": true,
      "order": 4
    }
  ]
}
