import { Authenticated, Refine, useLogin } from "@refinedev/core";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";

import {
  ErrorComponent,
  useNotificationProvider,
  ThemedLayout,
  ThemedSider,
} from "@refinedev/antd";
import "@refinedev/antd/dist/reset.css";

import { App as AntdApp, Button, Card, Checkbox, Col, Form, Input, Layout, Row, Typography } from "antd";
import { BrowserRouter, Route, Routes, Outlet } from "react-router";
import routerProvider, {
  NavigateToResource,
  CatchAllNavigate,
  UnsavedChangesNotifier,
  DocumentTitleHandler,
} from "@refinedev/react-router";
import {
  BlogPostList,
  BlogPostCreate,
  BlogPostEdit,
  BlogPostShow,
} from "./pages/blog-posts";
import {
  CategoryList,
  CategoryCreate,
  CategoryEdit,
  CategoryShow,
} from "./pages/categories";
import { ColorModeContextProvider } from "./contexts/color-mode";
import { Header } from "./components/header";
import { authProvider, readSavedLogin } from "./providers/auth";
import { dataProvider } from "./providers/data";

// 官方登录页把身份做成邮箱并校验格式。这里改成账号密码。
function LoginPage() {
  const savedLogin = readSavedLogin();
  const { mutate: login, isPending } = useLogin();

  return (
    <Layout style={{ minHeight: "100dvh" }}>
      <Row justify="center" align="middle" style={{ minHeight: "100dvh" }}>
        <Col xs={22} style={{ maxWidth: 400 }}>
          <Typography.Title level={3} style={{ textAlign: "center" }}>
            Weftbase
          </Typography.Title>
          <Card>
            <Typography.Title level={4}>Sign in to your account</Typography.Title>
            <Form
              layout="vertical"
              requiredMark={false}
              initialValues={{
                account: savedLogin?.account,
                password: savedLogin?.password,
                remember: Boolean(savedLogin),
              }}
              onFinish={(values) => login(values)}
            >
              <Form.Item
                name="account"
                label="Account"
                rules={[{ required: true, message: "Account is required" }]}
              >
                <Input size="large" placeholder="Account" autoComplete="username" />
              </Form.Item>
              <Form.Item
                name="password"
                label="Password"
                rules={[{ required: true, message: "Password is required" }]}
              >
                <Input.Password
                  size="large"
                  placeholder="Password"
                  autoComplete="current-password"
                />
              </Form.Item>
              <Form.Item name="remember" valuePropName="checked">
                <Checkbox>Remember me</Checkbox>
              </Form.Item>
              <Button type="primary" htmlType="submit" size="large" block loading={isPending}>
                Sign in
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </Layout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <RefineKbarProvider>
        <ColorModeContextProvider>
          <AntdApp>
            <Refine
              notificationProvider={useNotificationProvider}
              routerProvider={routerProvider}
              dataProvider={dataProvider}
              authProvider={authProvider}
              resources={[
                {
                  name: "blog_posts",
                  list: "/blog-posts",
                  create: "/blog-posts/create",
                  edit: "/blog-posts/edit/:id",
                  show: "/blog-posts/show/:id",
                  meta: {
                    canDelete: true,
                  },
                },
                {
                  name: "categories",
                  list: "/categories",
                  create: "/categories/create",
                  edit: "/categories/edit/:id",
                  show: "/categories/show/:id",
                  meta: {
                    canDelete: true,
                  },
                },
              ]}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
              }}
            >
              <Routes>
                <Route
                  element={
                    <Authenticated
                      key="authenticated"
                      fallback={<CatchAllNavigate to="/login" />}
                    >
                      <ThemedLayout
                        Header={() => <Header sticky />}
                        Sider={(props) => <ThemedSider {...props} fixed />}
                      >
                        <Outlet />
                      </ThemedLayout>
                    </Authenticated>
                  }
                >
                  <Route
                    index
                    element={<NavigateToResource resource="blog_posts" />}
                  />
                  <Route path="/blog-posts">
                    <Route index element={<BlogPostList />} />
                    <Route path="create" element={<BlogPostCreate />} />
                    <Route path="edit/:id" element={<BlogPostEdit />} />
                    <Route path="show/:id" element={<BlogPostShow />} />
                  </Route>
                  <Route path="/categories">
                    <Route index element={<CategoryList />} />
                    <Route path="create" element={<CategoryCreate />} />
                    <Route path="edit/:id" element={<CategoryEdit />} />
                    <Route path="show/:id" element={<CategoryShow />} />
                  </Route>
                  <Route path="*" element={<ErrorComponent />} />
                </Route>
                <Route
                  element={
                    <Authenticated key="guest" fallback={<Outlet />}>
                      <NavigateToResource resource="blog_posts" />
                    </Authenticated>
                  }
                >
                  <Route path="/login" element={<LoginPage />} />
                </Route>
              </Routes>

              <RefineKbar />
              <UnsavedChangesNotifier />
              <DocumentTitleHandler />
            </Refine>
          </AntdApp>
        </ColorModeContextProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;
