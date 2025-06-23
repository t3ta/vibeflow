// 業務ロジック抽出テスト用のサンプルGoコード

package main

import (
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// 複雑な業務ルールを含むユーザー管理システム
type User struct {
	ID          string
	Email       string
	Password    string
	Status      string
	CreatedAt   time.Time
	LastLogin   *time.Time
	FailedLogins int
}

type Order struct {
	ID         string
	UserID     string
	Items      []OrderItem
	TotalPrice float64
	Status     string
	CreatedAt  time.Time
}

type OrderItem struct {
	ProductID string
	Quantity  int
	Price     float64
}

// 業務ルール1: 複雑なユーザー検証
func CreateUser(email, password string) (*User, error) {
	// メールアドレス検証 - 複雑な業務ルール
	if !isValidEmail(email) {
		return nil, errors.New("invalid email format")
	}
	
	// パスワード強度チェック - 業務ルール
	if err := validatePassword(password); err != nil {
		return nil, fmt.Errorf("password validation failed: %w", err)
	}
	
	// ユーザー重複チェック - データアクセスを含む業務ルール
	if userExists(email) {
		return nil, errors.New("user already exists with this email")
	}
	
	// 業務ルール: 新規ユーザーはデフォルトでpendingステータス
	user := &User{
		ID:        generateUserID(),
		Email:     strings.ToLower(email),
		Password:  hashPassword(password),
		Status:    "pending", // ビジネスルール
		CreatedAt: time.Now(),
	}
	
	return user, nil
}

// 複雑な業務ルール: メール検証
func isValidEmail(email string) bool {
	// 業務ルール: 企業ドメインのみ許可
	if !strings.Contains(email, "@") {
		return false
	}
	
	// 正規表現による検証
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	if !emailRegex.MatchString(email) {
		return false
	}
	
	// 業務ルール: 禁止ドメインチェック
	forbiddenDomains := []string{"temp-mail.org", "10minutemail.com"}
	for _, domain := range forbiddenDomains {
		if strings.HasSuffix(email, "@"+domain) {
			return false
		}
	}
	
	return true
}

// 複雑なパスワード検証業務ルール
func validatePassword(password string) error {
	if len(password) < 8 {
		return errors.New("password must be at least 8 characters")
	}
	
	if len(password) > 128 {
		return errors.New("password must not exceed 128 characters")
	}
	
	// 大文字小文字数字特殊文字の要求
	hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(password)
	hasLower := regexp.MustCompile(`[a-z]`).MatchString(password)
	hasNumber := regexp.MustCompile(`[0-9]`).MatchString(password)
	hasSpecial := regexp.MustCompile(`[!@#$%^&*(),.?":{}|<>]`).MatchString(password)
	
	if !hasUpper || !hasLower || !hasNumber || !hasSpecial {
		return errors.New("password must contain uppercase, lowercase, number and special character")
	}
	
	// 業務ルール: よくあるパスワードの禁止
	commonPasswords := []string{"password", "123456", "qwerty"}
	for _, common := range commonPasswords {
		if strings.ToLower(password) == common {
			return errors.New("password is too common")
		}
	}
	
	return nil
}

// 業務ワークフロー: 注文処理
func ProcessOrder(order *Order, userID string) error {
	// 業務ルール: ユーザー認証チェック
	user, err := getUserByID(userID)
	if err != nil {
		return fmt.Errorf("user verification failed: %w", err)
	}
	
	// 業務ルール: アクティブユーザーのみ注文可能
	if user.Status != "active" {
		return errors.New("only active users can place orders")
	}
	
	// 業務ルール: 在庫チェック
	for _, item := range order.Items {
		if !checkInventory(item.ProductID, item.Quantity) {
			return fmt.Errorf("insufficient inventory for product %s", item.ProductID)
		}
	}
	
	// 複雑な料金計算業務ルール
	totalPrice, err := calculateOrderTotal(order)
	if err != nil {
		return fmt.Errorf("price calculation failed: %w", err)
	}
	order.TotalPrice = totalPrice
	
	// 業務ルール: 最小注文金額
	if order.TotalPrice < 10.0 {
		return errors.New("minimum order amount is $10.00")
	}
	
	// 業務ルール: 高額注文の承認要求
	if order.TotalPrice > 1000.0 {
		order.Status = "pending_approval"
	} else {
		order.Status = "confirmed"
	}
	
	// データベーストランザクション内での処理
	return executeOrderTransaction(order)
}

// 複雑な料金計算業務ルール
func calculateOrderTotal(order *Order) (float64, error) {
	var total float64
	
	for _, item := range order.Items {
		// 商品価格取得
		price, err := getProductPrice(item.ProductID)
		if err != nil {
			return 0, err
		}
		
		// 業務ルール: 数量割引
		itemTotal := price * float64(item.Quantity)
		if item.Quantity >= 10 {
			itemTotal *= 0.9 // 10個以上で10%割引
		}
		
		total += itemTotal
	}
	
	// 業務ルール: 税計算
	tax := total * 0.08 // 8%の消費税
	
	// 業務ルール: 送料計算
	var shipping float64
	if total < 50.0 {
		shipping = 5.0 // 50ドル未満は送料5ドル
	}
	
	return total + tax + shipping, nil
}

// データアクセスパターン: 複雑なクエリ
func getUserOrderHistory(db *sql.DB, userID string, limit int) ([]Order, error) {
	query := `
		SELECT o.id, o.user_id, o.total_price, o.status, o.created_at,
		       GROUP_CONCAT(oi.product_id) as product_ids,
		       GROUP_CONCAT(oi.quantity) as quantities
		FROM orders o
		LEFT JOIN order_items oi ON o.id = oi.order_id
		WHERE o.user_id = ? 
		  AND o.status IN ('confirmed', 'shipped', 'delivered')
		GROUP BY o.id
		ORDER BY o.created_at DESC
		LIMIT ?
	`
	
	rows, err := db.Query(query, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var orders []Order
	for rows.Next() {
		var order Order
		var productIDs, quantities string
		
		err := rows.Scan(
			&order.ID, &order.UserID, &order.TotalPrice, 
			&order.Status, &order.CreatedAt,
			&productIDs, &quantities,
		)
		if err != nil {
			return nil, err
		}
		
		// 複雑なデータ変換ロジック
		order.Items = parseOrderItems(productIDs, quantities)
		orders = append(orders, order)
	}
	
	return orders, nil
}

// 業務ワークフロー: ユーザーログイン処理
func AuthenticateUser(email, password string) (*User, error) {
	user, err := getUserByEmail(email)
	if err != nil {
		return nil, err
	}
	
	// 業務ルール: アカウントロック機能
	if user.FailedLogins >= 5 {
		return nil, errors.New("account is locked due to multiple failed login attempts")
	}
	
	// パスワード検証
	if !verifyPassword(password, user.Password) {
		// 失敗回数をインクリメント
		incrementFailedLogins(user.ID)
		return nil, errors.New("invalid credentials")
	}
	
	// 業務ルール: 成功時の処理
	user.FailedLogins = 0
	now := time.Now()
	user.LastLogin = &now
	updateUserLoginInfo(user)
	
	return user, nil
}

// ヘルパー関数（データアクセス）
func userExists(email string) bool {
	// データベースアクセス（省略）
	return false
}

func getUserByID(id string) (*User, error) {
	// データベースアクセス（省略）
	return nil, nil
}

func getUserByEmail(email string) (*User, error) {
	// データベースアクセス（省略）
	return nil, nil
}

func checkInventory(productID string, quantity int) bool {
	// 在庫システムとの連携（省略）
	return true
}

func getProductPrice(productID string) (float64, error) {
	// 商品管理システムとの連携（省略）
	return 0, nil
}

func executeOrderTransaction(order *Order) error {
	// データベーストランザクション（省略）
	return nil
}

func generateUserID() string {
	return "user_" + fmt.Sprintf("%d", time.Now().Unix())
}

func hashPassword(password string) string {
	return "hashed_" + password
}

func verifyPassword(password, hashedPassword string) bool {
	return hashPassword(password) == hashedPassword
}

func incrementFailedLogins(userID string) {
	// データベース更新（省略）
}

func updateUserLoginInfo(user *User) {
	// データベース更新（省略）
}

func parseOrderItems(productIDs, quantities string) []OrderItem {
	// データパース処理（省略）
	return []OrderItem{}
}