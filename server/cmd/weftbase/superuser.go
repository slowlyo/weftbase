package main

import (
	"database/sql"
	"errors"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/dbutils"
)

const (
	initialSuperuserUsername = "admin"
	initialSuperuserNickname = "admin"
	initialSuperuserEmail    = "admin@weftbase.local"
	initialSuperuserPassword = "weftbase-admin"
	superuserUsernameField   = "username"
	superuserNicknameField   = "nickname"
)

// ensureInitialSuperuser 补上账号字段，并在没有初始超级用户时创建它。
// 已有用户只补空账号，不覆盖后来改过的密码。
func ensureInitialSuperuser(app core.App) error {
	if err := ensureUsernameField(app); err != nil {
		return err
	}
	if err := ensureNicknameField(app); err != nil {
		return err
	}
	if err := ensureSuperuserRecord(app); err != nil {
		return err
	}
	registerNicknameDefault(app)
	return useUsernameLogin(app)
}

// registerNicknameDefault 在新建超级用户时补上昵称。
// 文本字段没有默认值配置，只能在写入前填。
func registerNicknameDefault(app core.App) {
	app.OnRecordCreate(core.CollectionNameSuperusers).BindFunc(func(e *core.RecordEvent) error {
		// 已经填了昵称就保留，避免覆盖调用方传入的值。
		if e.Record.GetString(superuserNicknameField) == "" {
			e.Record.Set(superuserNicknameField, initialSuperuserNickname)
		}
		return e.Next()
	})
}

// ensureUsernameField 给超级用户集合加账号字段和唯一索引。
// 先不加必填，避免已有记录在回填前保存失败。
func ensureUsernameField(app core.App) error {
	collection, err := app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
	if err != nil {
		return err
	}

	changed := false
	// 系统集合默认只有邮箱，登录身份需要单独的账号字段。
	if collection.Fields.GetByName(superuserUsernameField) == nil {
		collection.Fields.Add(&core.TextField{
			Name: superuserUsernameField,
			Max:  255,
		})
		changed = true
	}
	// 密码登录只接受带单列唯一索引的字段。
	if _, ok := dbutils.FindSingleColumnUniqueIndex(collection.Indexes, superuserUsernameField); !ok {
		collection.AddIndex("idx_superusers_username", true, "`username` COLLATE NOCASE", "")
		changed = true
	}
	if !changed {
		return nil
	}
	return app.Save(collection)
}

// ensureNicknameField 给超级用户加可选昵称，用来展示，不参与登录。
func ensureNicknameField(app core.App) error {
	collection, err := app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
	if err != nil {
		return err
	}
	// 字段已在时不重复保存，避免每次启动都改集合。
	if collection.Fields.GetByName(superuserNicknameField) != nil {
		return nil
	}
	collection.Fields.Add(&core.TextField{
		Name: superuserNicknameField,
		Max:  100,
	})
	return app.Save(collection)
}

// ensureSuperuserRecord 创建初始超级用户，或给已有记录补上账号和空昵称。
func ensureSuperuserRecord(app core.App) error {
	record, err := app.FindAuthRecordByEmail(core.CollectionNameSuperusers, initialSuperuserEmail)
	// 旧数据只有邮箱，补上账号后才能用账号登录。
	if err == nil {
		changed := false
		if record.GetString(superuserUsernameField) == "" {
			record.Set(superuserUsernameField, initialSuperuserUsername)
			changed = true
		}
		// 只填空白昵称，已经改过的不覆盖。
		if record.GetString(superuserNicknameField) == "" {
			record.Set(superuserNicknameField, initialSuperuserNickname)
			changed = true
		}
		if !changed {
			return nil
		}
		return app.Save(record)
	}
	// 查无记录才创建；其它错误说明库还不可用。
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	collection, err := app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
	if err != nil {
		return err
	}

	record = core.NewRecord(collection)
	record.Set("email", initialSuperuserEmail)
	record.Set(superuserUsernameField, initialSuperuserUsername)
	record.Set(superuserNicknameField, initialSuperuserNickname)
	record.Set("password", initialSuperuserPassword)
	return app.Save(record)
}

// useUsernameLogin 把密码登录身份改成账号，并要求账号必填。
func useUsernameLogin(app core.App) error {
	collection, err := app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
	if err != nil {
		return err
	}

	changed := false
	field, _ := collection.Fields.GetByName(superuserUsernameField).(*core.TextField)
	// 账号已经回填，这时才打开必填。
	if field != nil && !field.Required {
		field.Required = true
		changed = true
	}
	identity := collection.PasswordAuth.IdentityFields
	// 只保留账号，邮箱不再作为登录身份。
	if len(identity) != 1 || identity[0] != superuserUsernameField {
		collection.PasswordAuth.IdentityFields = []string{superuserUsernameField}
		changed = true
	}
	if !changed {
		return nil
	}
	return app.Save(collection)
}
