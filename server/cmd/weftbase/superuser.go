package main

import (
	"database/sql"
	"errors"

	"github.com/pocketbase/pocketbase/core"
)

const (
	initialSuperuserEmail    = "admin@weftbase.local"
	initialSuperuserPassword = "weftbase-admin"
)

// ensureInitialSuperuser 在没有任何同邮箱超级用户时写入初始账号。
// 已存在则跳过，避免每次启动覆盖后来改过的密码。
func ensureInitialSuperuser(app core.App) error {
	_, err := app.FindAuthRecordByEmail(core.CollectionNameSuperusers, initialSuperuserEmail)
	// 账号已经存在，保留现有密码。
	if err == nil {
		return nil
	}
	// 查无记录才创建；其它错误说明库还不可用。
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	collection, err := app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
	if err != nil {
		return err
	}

	record := core.NewRecord(collection)
	record.Set("email", initialSuperuserEmail)
	record.Set("password", initialSuperuserPassword)

	return app.Save(record)
}
