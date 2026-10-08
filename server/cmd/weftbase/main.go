package main

import (
	"log"
	"net/http"
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
	"github.com/pocketbase/pocketbase/tools/hook"
	"github.com/pocketbase/pocketbase/tools/osutils"

	_ "weftbase/migrations"
)

func main() {
	app := pocketbase.New()

	publicDir := "../web/dist"
	app.RootCmd.PersistentFlags().StringVar(
		&publicDir,
		"publicDir",
		publicDir,
		"前端构建产物目录；目录不存在时不挂静态路由",
	)

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		// air 跑的是编译产物，IsProbablyGoRun 为 false，开发时用环境变量打开自动迁移。
		Automigrate: osutils.IsProbablyGoRun() || os.Getenv("WEFTBASE_AUTOMIGRATE") == "1",
		Dir:         "migrations",
	})

	registerFrontend(app, &publicDir)
	registerInitialSuperuser(app)

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

// registerInitialSuperuser 在系统集合就绪后补上初始超级用户。
func registerInitialSuperuser(app *pocketbase.PocketBase) {
	app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
		// 系统集合还没建好时不能写超级用户。
		if err := e.Next(); err != nil {
			return err
		}

		return ensureInitialSuperuser(e.App)
	})
}

// registerFrontend 在 API 路由之后挂上前端构建产物。
// 开发时目录通常不存在，请求仍走 Vite；构建后由 PocketBase 直接托管 SPA。
func registerFrontend(app *pocketbase.PocketBase, publicDir *string) {
	app.OnServe().Bind(&hook.Handler[*core.ServeEvent]{
		Func: func(e *core.ServeEvent) error {
			// 产物目录不存在时跳过，开发阶段仍由 Vite 提供页面。
			if _, err := os.Stat(*publicDir); err != nil {
				return e.Next()
			}

			// 已有同模式路由时不覆盖，避免抢走更早注册的接口。
			if !e.Router.HasRoute(http.MethodGet, "/{path...}") {
				e.Router.GET("/{path...}", apis.Static(os.DirFS(*publicDir), true))
			}

			return e.Next()
		},
		Priority: 999,
	})
}
