package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(up, down)
}

// up 设置应用名，并创建与 Refine 示例页一致的 categories、blog_posts。
// 规则只放行已登录用户；nil 规则表示仅超级用户可访问。
func up(app core.App) error {
	if err := initSettings(app); err != nil {
		return err
	}

	categories, err := createCategories(app)
	if err != nil {
		return err
	}

	return createBlogPosts(app, categories.Id)
}

// down 先删文章再删分类，避免关系字段还指向已删除的集合。
func down(app core.App) error {
	posts, err := app.FindCollectionByNameOrId("blog_posts")
	if err != nil {
		return err
	}
	if err = app.Delete(posts); err != nil {
		return err
	}

	categories, err := app.FindCollectionByNameOrId("categories")
	if err != nil {
		return err
	}

	return app.Delete(categories)
}

// initSettings 只在首次迁移时写入名称和本地地址。
func initSettings(app core.App) error {
	settings := app.Settings()
	settings.Meta.AppName = "Weftbase"
	settings.Meta.AppURL = "http://127.0.0.1:8090"

	return app.Save(settings)
}

// allowAuthenticated 让业务账号能访问集合。超级用户不受这些规则限制。
func allowAuthenticated(collection *core.Collection) {
	rule := types.Pointer("@request.auth.id != ''")
	collection.ListRule = rule
	collection.ViewRule = rule
	collection.CreateRule = rule
	collection.UpdateRule = rule
	collection.DeleteRule = rule
}

// createCategories 对应示例里的分类页，标题字段名保持 title。
func createCategories(app core.App) (*core.Collection, error) {
	collection := core.NewBaseCollection("categories")
	allowAuthenticated(collection)
	collection.Fields.Add(&core.TextField{
		Name:        "title",
		Required:    true,
		Presentable: true,
		Max:         200,
	})

	if err := app.Save(collection); err != nil {
		return nil, err
	}

	return collection, nil
}

// createBlogPosts 对应示例里的文章页。分类存的是记录 id，不是嵌套对象。
func createBlogPosts(app core.App, categoryCollectionID string) error {
	collection := core.NewBaseCollection("blog_posts")
	allowAuthenticated(collection)
	collection.Fields.Add(
		&core.TextField{
			Name:        "title",
			Required:    true,
			Presentable: true,
			Max:         200,
		},
		&core.EditorField{
			Name:     "content",
			Required: true,
		},
		&core.RelationField{
			Name:         "category",
			Required:     true,
			MaxSelect:    1,
			CollectionId: categoryCollectionID,
		},
		&core.SelectField{
			Name:      "status",
			Required:  true,
			MaxSelect: 1,
			Values:    []string{"draft", "published", "rejected"},
		},
		&core.AutodateField{
			Name:     "createdAt",
			OnCreate: true,
		},
		&core.AutodateField{
			Name:     "updated",
			OnCreate: true,
			OnUpdate: true,
		},
	)

	return app.Save(collection)
}
