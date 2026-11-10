'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNav, initRouter } from '@/lib/store'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { ToastHost } from '@/components/layout/toast-host'
import { HomeView } from '@/components/views/home-view'
import { BrowseView } from '@/components/views/browse-view'
import { ListingView } from '@/components/views/listing-view'
import { DashboardView } from '@/components/views/dashboard-view'
import { AdminView } from '@/components/views/admin-view'
import { NewListingView } from '@/components/views/new-listing-view'
import { ChatPanelHost } from '@/components/chat/chat-panel-host'

export default function Page() {
  const view = useNav((s) => s.view)

  // U1: deep-link the current hash once, then keep store ↔ URL in sync
  // (browser back/forward buttons now navigate the SPA correctly).
  React.useEffect(() => initRouter(), [])

  const lastName = view.name
  React.useEffect(() => {
    if (
      view.name === 'home' ||
      view.name === 'browse' ||
      view.name === 'listing' ||
      view.name === 'admin' ||
      view.name === 'new-listing'
    ) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }
  }, [lastName])

  const viewKey =
    view.name === 'listing'
      ? `listing-${view.slug}`
      : view.name === 'browse'
        ? `browse-${('categorySlug' in view && view.categorySlug) || 'all'}-${('query' in view && view.query) || ''}`
        : view.name

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={viewKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {view.name === 'home' && <HomeView />}
            {view.name === 'browse' && <BrowseView />}
            {view.name === 'listing' && <ListingView slug={view.slug} />}
            {view.name === 'dashboard' && <DashboardView tab={view.tab} />}
            {view.name === 'admin' && <AdminView tab={view.tab} />}
            {view.name === 'new-listing' && <NewListingView />}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
      <ToastHost />
      <ChatPanelHost />
    </div>
  )
}
