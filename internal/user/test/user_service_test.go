package user_test

import (
    "context"
    "testing"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"
    "user/internal/user"
)

// MockIUserService is a mock implementation of IUserService
type MockIUserService struct {
    mock.Mock
}

func (m *MockIUserService) Get(ctx context.Context, id string) (*user.Entity, error) {
    args := m.Called(ctx, id)
    return args.Get(0).(*user.Entity), args.Error(1)
}

func (m *MockIUserService) Create(ctx context.Context, entity *user.Entity) error {
    args := m.Called(ctx, entity)
    return args.Error(0)
}

func (m *MockIUserService) Update(ctx context.Context, entity *user.Entity) error {
    args := m.Called(ctx, entity)
    return args.Error(0)
}

func (m *MockIUserService) Delete(ctx context.Context, id string) error {
    args := m.Called(ctx, id)
    return args.Error(0)
}

func TestGet_Success(t *testing.T) {
    // Arrange
    mockService := new(MockIUserService)
    expectedEntity := &user.Entity{ID: "test-id"}
    mockService.On("Get", mock.Anything, "test-id").Return(expectedEntity, nil)
    
    // Act
    result, err := mockService.Get(context.Background(), "test-id")
    
    // Assert
    assert.NoError(t, err)
    assert.Equal(t, expectedEntity, result)
    mockService.AssertExpectations(t)
}

func TestCreate_Success(t *testing.T) {
    // Arrange
    mockService := new(MockIUserService)
    entity := &user.Entity{ID: "test-id"}
    mockService.On("Create", mock.Anything, entity).Return(nil)
    
    // Act
    err := mockService.Create(context.Background(), entity)
    
    // Assert
    assert.NoError(t, err)
    mockService.AssertExpectations(t)
}
