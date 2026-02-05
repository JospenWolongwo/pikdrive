'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, Button, Switch, Label, Input, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { Bell, Shield, Globe, Phone, Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useLocale, useUserSettings } from "@/hooks";

export default function SettingsPage() {
  const { theme: currentTheme, setTheme: setCurrentTheme } = useTheme()
  const { t } = useLocale()
  const { settings, setSettings, loading, saveSettings } = useUserSettings()

  // Sync theme with theme provider when settings load or theme changes
  useEffect(() => {
    if (!loading && settings.theme && settings.theme !== currentTheme) {
      setCurrentTheme(settings.theme)
    }
  }, [loading, settings.theme, currentTheme, setCurrentTheme])

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">{t("common.loading")}</div>
  }

  return (
    <main className="container py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <h1 className="text-3xl font-bold mb-8">{t("pages.settings.title")}</h1>

        <Tabs defaultValue="notifications" className="space-y-6">
          <TabsList>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              {t("pages.settings.tabs.notifications")}
            </TabsTrigger>
            <TabsTrigger value="privacy">
              <Shield className="w-4 h-4 mr-2" />
              {t("pages.settings.tabs.privacy")}
            </TabsTrigger>
            <TabsTrigger value="preferences">
              <Globe className="w-4 h-4 mr-2" />
              {t("pages.settings.tabs.preferences")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">{t("pages.settings.notifications.title")}</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t("pages.settings.notifications.email")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("pages.settings.notifications.emailDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={settings.email_notifications}
                    onCheckedChange={() => handleToggle('email_notifications')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t("pages.settings.notifications.sms")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("pages.settings.notifications.smsDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={settings.sms_notifications}
                    onCheckedChange={() => handleToggle('sms_notifications')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t("pages.settings.notifications.whatsapp")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("pages.settings.notifications.whatsappDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={settings.whatsapp_notifications}
                    onCheckedChange={() => handleToggle('whatsapp_notifications')}
                  />
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">{t("pages.settings.privacy.title")}</h2>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("pages.settings.privacy.phone")}</Label>
                  <div className="flex gap-4">
                    <Input
                      type="tel"
                      placeholder="+237 XXX XXX XXX"
                      value={settings.phone_number}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        phone_number: e.target.value
                      }))}
                    />
                    <Button variant="outline">
                      <Phone className="w-4 h-4 mr-2" />
                      {t("pages.settings.privacy.verify")}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("pages.settings.privacy.emailVisibility")}</Label>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {t("pages.settings.privacy.emailVisibilityDesc")}
                    </p>
                    <Switch
                      checked={settings.email_notifications}
                      onCheckedChange={() => handleToggle('email_notifications')}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">{t("pages.settings.preferences.title")}</h2>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("pages.settings.preferences.language")}</Label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={settings.language}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      language: e.target.value
                    }))}
                  >
                    <option value="fr">{t("language.french")}</option>
                    <option value="en">{t("language.english")}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>{t("pages.settings.preferences.timezone")}</Label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={settings.timezone}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      timezone: e.target.value
                    }))}
                  >
                    <option value="Africa/Douala">Cameroun (GMT+1)</option>
                    <option value="Africa/Lagos">Nigeria (GMT+1)</option>
                    <option value="Africa/Kinshasa">RDC (GMT+1)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>{t("pages.settings.preferences.theme")}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSettings(prev => ({ ...prev, theme: 'system' }))
                        setCurrentTheme('system')
                      }}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                        settings.theme === 'system' 
                          ? 'border-primary bg-primary/10 text-primary' 
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <Monitor className="w-4 h-4" />
                      <span className="text-sm">{t("theme.system")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSettings(prev => ({ ...prev, theme: 'light' }))
                        setCurrentTheme('light')
                      }}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                        settings.theme === 'light' 
                          ? 'border-primary bg-primary/10 text-primary' 
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <Sun className="w-4 h-4" />
                      <span className="text-sm">{t("theme.light")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSettings(prev => ({ ...prev, theme: 'dark' }))
                        setCurrentTheme('dark')
                      }}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                        settings.theme === 'dark' 
                          ? 'border-primary bg-primary/10 text-primary' 
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <Moon className="w-4 h-4" />
                      <span className="text-sm">{t("theme.dark")}</span>
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("pages.settings.preferences.themeDescription")}
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end">
          <Button onClick={saveSettings}>
            {t("pages.settings.saveChanges")}
          </Button>
        </div>
      </motion.div>
    </main>
  )
}
