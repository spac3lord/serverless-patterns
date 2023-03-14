aws dynamodb put-item --table-name=Orders-Table --item '{"id":{"S":"111777"},"userId":{"S":"user123"},"tickets":{"L":[{"M":{"id":{"S":"ticket1"}}},{"M":{"id":{"S":"ticket2"}}},{"M":{"id":{"S":"ticket3"}}}]}}'
aws dynamodb put-item --table-name=Orders-Table --item '{"id":{"S":"111888"},"userId":{"S":"user123"},"tickets":{"L":[{"M":{"id":{"S":"ticket1"}}},{"M":{"id":{"S":"ticket2"}}},{"M":{"id":{"S":"ticket3"}}}]}}'
aws dynamodb put-item --table-name=Orders-Table --item '{"id":{"S":"111999"},"userId":{"S":"user123"},"tickets":{"L":[{"M":{"id":{"S":"ticket1"}}},{"M":{"id":{"S":"ticket2"}}},{"M":{"id":{"S":"ticket3"}}}]}}'

