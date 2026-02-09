import Layout from '@/components/Layout'
import Breadcrumbs from '@/components/Breadcrumbs'
import {
  ChatBubbleVariants,
  ChatBubbleAiLayout,
  ChatBubbleStates,
} from '@/components/ui/chat-bubble-demo'

export default function ChatBubbleDemoPage() {
  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <Breadcrumbs />
        <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-6">
          Chat bubble components
        </h1>

        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Variants</h2>
          <ChatBubbleVariants />
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            AI layout (message list)
          </h2>
          <ChatBubbleAiLayout />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">States</h2>
          <ChatBubbleStates />
        </section>
      </div>
    </Layout>
  )
}
