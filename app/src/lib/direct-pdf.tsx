import {
  Document,
  Font,
  Image as PdfImage,
  ImageBackground as PdfImageBackground,
  Link,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
} from '@react-pdf/renderer'
import { Buffer } from 'buffer'
import robotoBoldUrl from 'roboto-fontface/fonts/roboto/Roboto-Bold.woff?url'
import robotoRegularUrl from 'roboto-fontface/fonts/roboto/Roboto-Regular.woff?url'
import robotoSlabBoldUrl from 'roboto-fontface/fonts/roboto-slab/Roboto-Slab-Bold.woff?url'
import robotoSlabRegularUrl from 'roboto-fontface/fonts/roboto-slab/Roboto-Slab-Regular.woff?url'
import {
  findBackCoverMedia,
  findCoverMedia,
  getBookNavigationEntries,
  getBackCoverPhotoOverride,
  getCoverPhotoOverride,
  getPageDimensions,
  getParticipantProfile,
  getPhotoOverride,
  type BookNavigationEntry,
  type BookSettings,
} from './book-model'
import {
  ensureReadableColor,
  getJournalPageDecoration,
  getCompositionColors,
  SCRAPBOOK_PHOTO_MAT,
  type BookDateStyle,
} from './book-style'
import type { ChatMessage } from './chat-types'
import { getCompositionMetrics, isDesignedComposition, layoutCompositionPage } from './book-composition'

const globalWithBuffer = globalThis as typeof globalThis & {
  Buffer?: typeof Buffer
}
if (!globalWithBuffer.Buffer) globalWithBuffer.Buffer = Buffer

Font.register({
  family: 'Chatbound Sans',
  fonts: [
    { src: robotoRegularUrl, fontWeight: 400 },
    { src: robotoBoldUrl, fontWeight: 700 },
  ],
})
Font.register({
  family: 'Chatbound Serif',
  fonts: [
    { src: robotoSlabRegularUrl, fontWeight: 400 },
    { src: robotoSlabBoldUrl, fontWeight: 700 },
  ],
})
Font.registerHyphenationCallback((word) => [word])

const POINTS_PER_MM = 72 / 25.4

const fullDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const compactDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const minimalDate = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
})
const shortDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
})

const styles = StyleSheet.create({
  page: {
    position: 'relative',
    fontFamily: 'Chatbound Sans',
  },
  coverPage: {
    position: 'relative',
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  coverImagePane: {
    overflow: 'hidden',
  },
  coverCopy: {
    padding: '8%',
    display: 'flex',
    flexDirection: 'column',
  },
  coverKicker: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  coverTitle: {
    marginTop: 12,
    fontFamily: 'Chatbound Serif',
    fontWeight: 700,
    fontSize: 31,
    lineHeight: 0.98,
  },
  coverSubtitle: {
    marginTop: 11,
    fontSize: 11,
    lineHeight: 1.35,
  },
  coverDate: {
    marginTop: 'auto',
    fontSize: 8,
    fontWeight: 700,
  },
  fullCoverBackground: {
    width: '100%',
    height: '100%',
  },
  fullCoverCopy: {
    width: '100%',
    height: '100%',
    padding: '9%',
    display: 'flex',
    flexDirection: 'column',
  },
  backCoverText: {
    maxWidth: '82%',
    fontFamily: 'Chatbound Serif',
    fontSize: 13,
    lineHeight: 1.45,
  },
  pageContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  chapter: {
    marginBottom: 13,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  chapterKicker: {
    marginBottom: 3,
    fontSize: 7,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  chapterTitle: {
    fontFamily: 'Chatbound Serif',
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1.05,
  },
  day: {
    marginBottom: 9,
  },
  date: {
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 0.6,
    fontFamily: 'Chatbound Serif',
    fontSize: 10,
    fontWeight: 700,
  },
  message: {
    marginBottom: 7,
  },
  messageMeta: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    gap: 5,
  },
  sender: {
    fontSize: 7.5,
    fontWeight: 700,
  },
  messageTime: {
    fontSize: 6.5,
    opacity: 0.68,
  },
  continuation: {
    marginLeft: 'auto',
    fontSize: 6,
    opacity: 0.58,
  },
  messageBody: {
    fontSize: 8.2,
  },
  photoFrame: {
    width: '100%',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  caption: {
    marginTop: 3,
    fontSize: 7,
    lineHeight: 1.25,
    opacity: 0.82,
  },
  missingPhoto: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf0ed',
  },
  missingPhotoText: {
    fontSize: 7,
    opacity: 0.62,
  },
  editorial: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  editorialKicker: {
    marginBottom: 8,
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  editorialTitle: {
    fontFamily: 'Chatbound Serif',
    fontSize: 25,
    fontWeight: 700,
    lineHeight: 1.05,
  },
  editorialBody: {
    marginTop: 20,
    fontFamily: 'Chatbound Serif',
    fontSize: 11,
    lineHeight: 1.55,
  },
  toc: {
    flex: 1,
  },
  tocEntry: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 0.5,
    textDecoration: 'none',
  },
  tocLabel: {
    flex: 1,
    fontSize: 9,
  },
  tocPage: {
    marginLeft: 12,
    fontSize: 9,
    fontWeight: 700,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 10,
    fontSize: 7,
    opacity: 0.62,
  },
})

type MediaUrls = Record<string, string>

interface DirectPdfDocumentProps {
  settings: BookSettings
  messages: ChatMessage[]
  pages: ChatMessage[][]
  mediaUrls: MediaUrls
}

function formatBookDate(timestamp: number, style: BookDateStyle): string {
  if (style === 'compact') return compactDate.format(timestamp)
  if (style === 'minimal') return minimalDate.format(timestamp)
  return fullDate.format(timestamp)
}

function dateKey(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function pagePadding(settings: BookSettings): number {
  if (settings.artDirection.density === 'airy') return 32
  if (settings.artDirection.density === 'compact') return 22
  return 27
}

function participantColor(settings: BookSettings, sender: string | null): string {
  if (settings.artDirection.participantPalette === 'accent') {
    return ensureReadableColor(settings.accent, settings.artDirection.paperColor)
  }
  if (settings.artDirection.participantPalette === 'neutral') {
    return settings.artDirection.inkColor
  }
  const profile = getParticipantProfile(settings, sender)
  return profile
    ? ensureReadableColor(profile.color, settings.artDirection.paperColor)
    : settings.artDirection.inkColor
}

function editorialKicker(kind: NonNullable<ChatMessage['editorial']>['kind']): string {
  if (kind === 'dedication') return 'Dédicace'
  if (kind === 'introduction') return 'Avant-propos'
  if (kind === 'epilogue') return 'Épilogue'
  if (kind === 'table-of-contents') return 'Dans ce livre'
  return 'Interlude'
}

function pageBookmark(
  entries: BookNavigationEntry[],
  pageIndex: number,
): string | undefined {
  return entries.find((entry) => (
    entry.pageIndex === pageIndex && entry.type !== 'bookmark'
  ))?.label ?? entries.find((entry) => entry.pageIndex === pageIndex)?.label
}

function CoverImage({
  source,
  settings,
  mediaName,
}: {
  source: string | null
  settings: BookSettings
  mediaName: string | null
}) {
  if (!source || !mediaName) {
    return (
      <View style={[styles.coverImage, styles.missingPhoto]}>
        <Text style={styles.missingPhotoText}>Photo de couverture indisponible</Text>
      </View>
    )
  }
  const override = getCoverPhotoOverride(settings, mediaName)
  return (
    <PdfImage
      src={source}
      style={[
        styles.coverImage,
        {
          objectFit: override.fit,
          objectPositionX: `${override.focalX}%`,
          objectPositionY: `${override.focalY}%`,
          transform: `rotate(${override.rotation}deg)`,
        },
      ]}
    />
  )
}

function CoverCopy({
  settings,
  messages,
  color,
}: {
  settings: BookSettings
  messages: ChatMessage[]
  color: string
}) {
  const dateRange = messages.length
    ? `${shortDate.format(messages[0].timestamp)} — ${shortDate.format(messages.at(-1)!.timestamp)}`
    : 'Sélection vide'
  return (
    <>
      <Text style={[styles.coverKicker, { color }]}>Une histoire en messages</Text>
      <Text style={[styles.coverTitle, { color }]}>{settings.title || 'Sans titre'}</Text>
      {settings.subtitle ? (
        <Text style={[styles.coverSubtitle, { color }]}>{settings.subtitle}</Text>
      ) : null}
      <Text style={[styles.coverDate, { color }]}>{dateRange}</Text>
    </>
  )
}

function CoverPage({
  settings,
  messages,
  mediaUrls,
  size,
}: DirectPdfDocumentProps & { size: { width: number; height: number } }) {
  const coverMedia = findCoverMedia(messages, settings.coverMediaName)
  const source = coverMedia ? mediaUrls[coverMedia] ?? null : null
  const layout = settings.artDirection.coverLayout
  const centered = settings.artDirection.coverTitlePosition === 'center'
  if (layout === 'full-image') {
    const coverCopy = (
      <View
        style={[
          styles.fullCoverCopy,
          {
            backgroundColor: `rgba(0, 0, 0, ${settings.artDirection.coverOverlay / 100})`,
          },
          centered
            ? { justifyContent: 'center', alignItems: 'center', textAlign: 'center' }
            : { justifyContent: 'flex-end' },
        ]}
      >
        <CoverCopy settings={settings} messages={messages} color="#ffffff" />
      </View>
    )
    return (
      <Page
        wrap={false}
        size={size}
        id="page-0"
        bookmark={{ title: settings.title || 'Couverture', fit: true, expanded: true }}
        style={[
          styles.coverPage,
          {
            width: size.width,
            height: size.height,
            minHeight: size.height,
            maxHeight: size.height,
            backgroundColor: settings.artDirection.paperColor,
          },
        ]}
      >
        {source && coverMedia ? (
          <PdfImageBackground
            src={source}
            style={styles.fullCoverBackground}
            imageStyle={{
              objectFit: getCoverPhotoOverride(settings, coverMedia).fit,
              objectPositionX: `${getCoverPhotoOverride(settings, coverMedia).focalX}%`,
              objectPositionY: `${getCoverPhotoOverride(settings, coverMedia).focalY}%`,
              transform: `rotate(${getCoverPhotoOverride(settings, coverMedia).rotation}deg)`,
            }}
          >
            {coverCopy}
          </PdfImageBackground>
        ) : (
          <View
            style={[
              styles.fullCoverBackground,
              { backgroundColor: settings.artDirection.paperColor },
            ]}
          >
            {coverCopy}
          </View>
        )}
      </Page>
    )
  }

  if (layout === 'typographic') {
    return (
      <Page
        wrap={false}
        size={size}
        id="page-0"
        bookmark={{ title: settings.title || 'Couverture', fit: true, expanded: true }}
        style={[
          styles.coverPage,
          {
            width: size.width,
            height: size.height,
            minHeight: size.height,
            maxHeight: size.height,
            padding: '10%',
            backgroundColor: settings.artDirection.paperColor,
            borderLeftWidth: 8,
            borderLeftColor: settings.accent,
          },
        ]}
      >
        <View
          style={[
            styles.coverCopy,
            {
              flex: 1,
              justifyContent: 'center',
              alignItems: centered ? 'center' : 'flex-start',
              textAlign: centered ? 'center' : 'left',
            },
          ]}
        >
          <CoverCopy
            settings={settings}
            messages={messages}
            color={settings.artDirection.inkColor}
          />
        </View>
      </Page>
    )
  }

  const landscape = settings.orientation === 'landscape'
  return (
    <Page
      wrap={false}
      size={size}
      id="page-0"
      bookmark={{ title: settings.title || 'Couverture', fit: true, expanded: true }}
      style={[
        styles.coverPage,
        {
          width: size.width,
          height: size.height,
          minHeight: size.height,
          maxHeight: size.height,
          flexDirection: landscape ? 'row' : 'column',
        },
      ]}
    >
      <View style={[styles.coverImagePane, { flex: landscape ? 0.57 : 0.58 }]}>
        <CoverImage source={source} settings={settings} mediaName={coverMedia} />
      </View>
      <View
        style={[
          styles.coverCopy,
          {
            flex: landscape ? 0.43 : 0.42,
            color: '#ffffff',
            backgroundColor: settings.accent,
            alignItems: centered ? 'center' : 'flex-start',
            textAlign: centered ? 'center' : 'left',
          },
        ]}
      >
        <CoverCopy settings={settings} messages={messages} color="#ffffff" />
      </View>
    </Page>
  )
}

function EditorialContent({
  message,
  settings,
}: {
  message: ChatMessage
  settings: BookSettings
}) {
  const editorial = message.editorial!
  if (editorial.kind === 'blank') return null
  if (editorial.kind === 'table-of-contents') {
    return (
      <View style={styles.toc}>
        <Text style={[styles.editorialKicker, { color: settings.accent }]}>Dans ce livre</Text>
        <Text style={[styles.editorialTitle, { color: settings.artDirection.inkColor }]}>
          {editorial.title}
        </Text>
        <View style={{ marginTop: 18 }}>
          {editorial.entries?.map((entry) => (
            <Link
              key={entry.id}
              src={`#page-${entry.page}`}
              style={[
                styles.tocEntry,
                {
                  color: settings.artDirection.inkColor,
                  borderBottomColor: settings.accent,
                },
              ]}
            >
              <Text style={styles.tocLabel}>{entry.label}</Text>
              <Text style={[styles.tocPage, { color: settings.accent }]}>{entry.page}</Text>
            </Link>
          ))}
        </View>
      </View>
    )
  }
  return (
    <View style={styles.editorial}>
      <Text style={[styles.editorialKicker, { color: settings.accent }]}>
        {editorialKicker(editorial.kind)}
      </Text>
      <Text style={[styles.editorialTitle, { color: settings.artDirection.inkColor }]}>
        {editorial.title}
      </Text>
      <Text style={[styles.editorialBody, { color: settings.artDirection.inkColor }]}>
        {message.body}
      </Text>
      {message.continuation ? (
        <Text style={[styles.continuation, { marginTop: 12 }]}>
          {message.continuation.part}/{message.continuation.total}
        </Text>
      ) : null}
    </View>
  )
}

function BackCoverPage({
  settings,
  messages,
  mediaUrls,
  size,
  pageIndex,
}: DirectPdfDocumentProps & {
  size: { width: number; height: number }
  pageIndex: number
}) {
  const mediaName = findBackCoverMedia(messages, settings.backCover.mediaName)
  const source = mediaName ? mediaUrls[mediaName] ?? null : null
  const isPhoto = settings.backCover.layout === 'photo' && Boolean(source && mediaName)
  const centered = settings.backCover.textPosition === 'center'
  const copy = (
    <View
      style={[
        styles.fullCoverCopy,
        isPhoto ? {
          backgroundColor: `rgba(0, 0, 0, ${settings.backCover.overlay / 100})`,
        } : {},
        centered
          ? { justifyContent: 'center', alignItems: 'center', textAlign: 'center' }
          : { justifyContent: 'flex-end', alignItems: 'flex-start', textAlign: 'left' },
      ]}
    >
      {settings.backCover.text ? (
        <Text
          style={[
            styles.backCoverText,
            {
              color: isPhoto ? '#ffffff' : settings.artDirection.inkColor,
            },
          ]}
        >
          {settings.backCover.text}
        </Text>
      ) : null}
    </View>
  )

  return (
    <Page
      wrap={false}
      size={size}
      id={`page-${pageIndex}`}
      bookmark={{ title: 'Quatrième de couverture', fit: true }}
      style={[
        styles.coverPage,
        {
          width: size.width,
          height: size.height,
          minHeight: size.height,
          maxHeight: size.height,
          backgroundColor: settings.artDirection.paperColor,
          borderRightWidth: isPhoto ? 0 : 8,
          borderRightColor: settings.accent,
        },
      ]}
    >
      {isPhoto && source && mediaName ? (
        <PdfImageBackground
          src={source}
          style={styles.fullCoverBackground}
          imageStyle={{
            objectFit: getBackCoverPhotoOverride(settings, mediaName).fit,
            objectPositionX: `${getBackCoverPhotoOverride(settings, mediaName).focalX}%`,
            objectPositionY: `${getBackCoverPhotoOverride(settings, mediaName).focalY}%`,
            transform: `rotate(${getBackCoverPhotoOverride(settings, mediaName).rotation}deg)`,
          }}
        >
          {copy}
        </PdfImageBackground>
      ) : (
        <View style={styles.fullCoverBackground}>{copy}</View>
      )}
    </Page>
  )
}

function MessageContent({
  message,
  settings,
  mediaUrls,
  photoHeight,
  alternate,
}: {
  message: ChatMessage
  settings: BookSettings
  mediaUrls: MediaUrls
  photoHeight: number
  alternate: boolean
}) {
  const sourceMessageId = message.sourceMessageId ?? message.id
  const override = getPhotoOverride(settings, sourceMessageId)
  const profile = getParticipantProfile(settings, message.sender)
  const color = participantColor(settings, message.sender)
  const source = message.mediaName ? mediaUrls[message.mediaName] : null
  const compositionFontPt = isDesignedComposition(settings.theme)
    ? getCompositionMetrics({
        theme: settings.theme,
        ...getPageDimensions(settings.format, settings.orientation),
        fontScale: settings.fontScale,
        lineHeight: settings.artDirection.lineHeight,
        photoOverrides: settings.photoOverrides,
      }).fontPt
    : null
  const hasPhotoMat = settings.artDirection.preset === 'scrapbook' &&
    settings.artDirection.photoFrame === 'bordered'
  const conversationStyle = settings.theme === 'conversation'
    ? {
        width: '86%',
        alignSelf: alternate ? 'flex-end' as const : 'flex-start' as const,
        padding: 7,
        borderRadius: 5,
        backgroundColor: alternate ? '#edf4f1' : '#f2f3f1',
      }
    : {}
  return (
    <View style={[styles.message, conversationStyle]} wrap={false}>
      <View style={[styles.messageMeta, settings.theme === 'collage' ? { flexWrap: 'wrap' } : {}]}>
        {settings.theme === 'collage' ? (
          <Text style={{ fontSize: 6, color: ensureReadableColor(settings.accent, settings.artDirection.paperColor) }}>
            {formatBookDate(message.timestamp, settings.artDirection.dateStyle)}
          </Text>
        ) : null}
        <Text style={[styles.sender, { color }]}>
          {profile?.displayName.trim() || message.sender || 'WhatsApp'}
        </Text>
        <Text style={[styles.messageTime, { color: settings.artDirection.inkColor }]}>
          {timeFormatter.format(message.timestamp)}
        </Text>
        {message.continuation ? (
          <Text style={[styles.continuation, { color: settings.artDirection.inkColor }]}>
            suite {message.continuation.part}/{message.continuation.total}
          </Text>
        ) : null}
      </View>
      {message.mediaName ? (
        <>
          <View
            style={[
              styles.photoFrame,
              {
                height: override.layout === 'full-page' && !compositionFontPt ? photoHeight * 1.55 : photoHeight,
                borderRadius: settings.artDirection.photoFrame === 'soft' ? 5 : 0,
                borderWidth: settings.artDirection.photoFrame === 'bordered' ? 1 : 0,
                borderColor: hasPhotoMat ? SCRAPBOOK_PHOTO_MAT.color : settings.accent,
                ...(hasPhotoMat ? {
                  borderWidth: SCRAPBOOK_PHOTO_MAT.sideMm * POINTS_PER_MM,
                  borderBottomWidth: SCRAPBOOK_PHOTO_MAT.bottomMm * POINTS_PER_MM,
                } : {}),
              },
            ]}
          >
            {source ? (
              <PdfImage
                src={source}
                style={[
                  styles.photo,
                  {
                    objectFit: override.fit,
                    objectPositionX: `${override.focalX}%`,
                    objectPositionY: `${override.focalY}%`,
                    transform: `rotate(${override.rotation}deg)`,
                  },
                ]}
              />
            ) : (
              <View style={[styles.photo, styles.missingPhoto]}>
                <Text style={styles.missingPhotoText}>Image indisponible</Text>
              </View>
            )}
          </View>
          {message.body && override.showCaption ? (
            <Text style={[styles.caption, {
              color: settings.artDirection.inkColor,
              ...(compositionFontPt ? {
                fontSize: compositionFontPt,
                lineHeight: settings.artDirection.lineHeight,
                marginTop: 2 * POINTS_PER_MM,
              } : {}),
            }]}>
              {message.body}
            </Text>
          ) : null}
        </>
      ) : (
        <Text
          style={[
            styles.messageBody,
            {
              color: settings.artDirection.inkColor,
              lineHeight: settings.artDirection.lineHeight,
              ...(compositionFontPt ? { fontSize: compositionFontPt } : {}),
            },
          ]}
        >
          {message.body}
        </Text>
      )}
    </View>
  )
}

function DesignedConversationContent({
  page,
  settings,
  mediaUrls,
}: {
  page: ChatMessage[]
  settings: BookSettings
  mediaUrls: MediaUrls
}) {
  if (!isDesignedComposition(settings.theme)) return null
  const layout = layoutCompositionPage(page, {
    theme: settings.theme,
    ...getPageDimensions(settings.format, settings.orientation),
    fontScale: settings.fontScale,
    lineHeight: settings.artDirection.lineHeight,
    photoOverrides: settings.photoOverrides,
    photoAspectRatios: settings.photoAspectRatios,
  })
  const isGazette = settings.theme === 'gazette'
  const isCollage = settings.theme === 'collage'
  const isStory = settings.theme === 'photo-story'
  const compositionColors = getCompositionColors(settings.artDirection, settings.accent)
  const accent = ensureReadableColor(settings.accent, settings.artDirection.paperColor)
  const headingFont = settings.artDirection.fontPair === 'modern' ||
    settings.artDirection.fontPair === 'correspondence'
    ? 'Chatbound Sans'
    : 'Chatbound Serif'
  const bodyFont = isGazette || settings.artDirection.fontPair === 'literary' ||
    settings.artDirection.fontPair === 'correspondence'
    ? 'Chatbound Serif'
    : 'Chatbound Sans'
  return (
    <View style={{
      position: 'absolute',
      top: layout.marginMm * POINTS_PER_MM,
      left: layout.marginMm * POINTS_PER_MM,
      width: layout.widthMm * POINTS_PER_MM,
      height: (layout.heightMm + layout.headerMm + layout.headerGapMm + 6) * POINTS_PER_MM,
      fontFamily: bodyFont,
    }}>
      {layout.headerMm > 0 ? <View style={{
        height: layout.headerMm * POINTS_PER_MM,
        paddingTop: isGazette ? 2 * POINTS_PER_MM : 0,
        borderTopWidth: isGazette ? 0.3 * POINTS_PER_MM : 0,
        borderBottomWidth: isStory ? 0 : (isGazette ? 1 : 0.4) * POINTS_PER_MM,
        borderBottomColor: isGazette ? settings.artDirection.inkColor : accent,
        borderBottomStyle: isCollage ? 'dashed' : 'solid',
        textAlign: isGazette ? 'center' : 'left',
      }}>
        <Text style={{ fontSize: 7, marginBottom: POINTS_PER_MM, opacity: 0.7 }}>
          {page[0]?.chapterTitle ? 'Chapitre' : settings.subtitle}
        </Text>
        <Text style={{
          fontFamily: isGazette ? 'Chatbound Serif' : headingFont,
          fontSize: isGazette ? 20 : isCollage ? 14 : 17,
          fontWeight: isGazette ? 700 : 500,
          lineHeight: 1.05,
        }}>
          {page[0]?.chapterTitle || settings.title}
        </Text>
      </View> : null}
      {isGazette ? (
        <View style={{
          position: 'absolute',
          left: layout.widthMm / 2 * POINTS_PER_MM,
          top: (layout.headerMm + layout.headerGapMm) * POINTS_PER_MM,
          height: layout.heightMm * POINTS_PER_MM,
          borderLeftWidth: 0.15 * POINTS_PER_MM,
          borderLeftColor: '#c4c6c3',
        }} />
      ) : null}
      {layout.items.map((item) => (
        <View key={item.message.id} style={{
          position: 'absolute',
          left: item.xMm * POINTS_PER_MM,
          top: (layout.headerMm + layout.headerGapMm + item.yMm) * POINTS_PER_MM,
          width: item.widthMm * POINTS_PER_MM,
          height: item.heightMm * POINTS_PER_MM,
          padding: layout.tilePaddingMm * POINTS_PER_MM,
          backgroundColor: isCollage ? (item.message.mediaName ? '#ffffff' : compositionColors.notePaper) : 'transparent',
          transform: `rotate(${item.rotation}deg)`,
        }}>
          {isCollage && item.message.mediaName ? (
            <View style={{
              position: 'absolute',
              top: -1.5 * POINTS_PER_MM,
              left: (item.widthMm / 2 - 9) * POINTS_PER_MM,
              width: 18 * POINTS_PER_MM,
              height: 4 * POINTS_PER_MM,
              backgroundColor: compositionColors.tape,
              opacity: 0.85,
            }} />
          ) : null}
          {isStory && !layout.fullPagePhoto ? (
            <View style={{
              position: 'absolute',
              left: -22 * POINTS_PER_MM,
              top: 0,
              width: 18 * POINTS_PER_MM,
              color: accent,
            }}>
              <Text style={{ fontSize: 27, fontFamily: headingFont, lineHeight: 1 }}>
                {new Date(item.message.timestamp).getDate().toString().padStart(2, '0')}
              </Text>
              <Text style={{ fontSize: 6.5, marginTop: POINTS_PER_MM }}>
                {new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(item.message.timestamp)}
              </Text>
            </View>
          ) : null}
          {!isCollage ? <Text style={{
            fontSize: isCollage ? 6 : 6.5,
            lineHeight: isCollage ? 1.15 : 1.2,
            ...(isCollage ? { height: 5 * POINTS_PER_MM } : {}),
            marginBottom: (isCollage ? 0.5 : 1.4) * POINTS_PER_MM,
            color: accent,
            opacity: isStory && !layout.fullPagePhoto ? 0 : 1,
            paddingTop: isGazette ? POINTS_PER_MM : 0,
            borderTopWidth: isGazette ? 0.2 * POINTS_PER_MM : 0,
          }}>
            {formatBookDate(item.message.timestamp, settings.artDirection.dateStyle)}
          </Text> : null}
          <MessageContent
            message={item.message}
            settings={settings}
            mediaUrls={mediaUrls}
            photoHeight={item.photoHeightMm * POINTS_PER_MM}
            alternate={item.index % 2 === 1}
          />
        </View>
      ))}
    </View>
  )
}

function ConversationContent({
  page,
  settings,
  mediaUrls,
  contentHeight,
}: {
  page: ChatMessage[]
  settings: BookSettings
  mediaUrls: MediaUrls
  contentHeight: number
}) {
  const senders = Array.from(new Set(page.flatMap((message) => (
    message.sender ? [message.sender] : []
  ))))
  const mediaCount = page.filter((message) => message.mediaName).length
  const photoHeight = Math.max(
    64,
    Math.min(250, (contentHeight - page.length * 19) / Math.max(1, mediaCount)),
  )
  const dayGroups = page.reduce<Array<{
    key: string
    timestamp: number
    messages: ChatMessage[]
  }>>((groups, message) => {
    const key = dateKey(message.timestamp)
    const current = groups.at(-1)
    if (current?.key === key) current.messages.push(message)
    else groups.push({ key, timestamp: message.timestamp, messages: [message] })
    return groups
  }, [])

  return (
    <View style={styles.pageContent}>
      {page[0]?.chapterTitle ? (
        <View
          style={[
            styles.chapter,
            {
              borderBottomColor: settings.accent,
              backgroundColor: settings.artDirection.chapterStyle === 'band'
                ? settings.accent
                : 'transparent',
              padding: settings.artDirection.chapterStyle === 'band' ? 8 : 0,
            },
          ]}
        >
          <Text
            style={[
              styles.chapterKicker,
              { color: settings.artDirection.chapterStyle === 'band' ? '#ffffff' : settings.accent },
            ]}
          >
            Chapitre
          </Text>
          <Text
            style={[
              styles.chapterTitle,
              { color: settings.artDirection.chapterStyle === 'band' ? '#ffffff' : settings.artDirection.inkColor },
            ]}
          >
            {page[0].chapterTitle}
          </Text>
        </View>
      ) : null}
      {dayGroups.map((group) => (
        <View key={group.key} style={styles.day} wrap={false}>
          <Text
            style={[
              styles.date,
              {
                color: settings.artDirection.dateHeadingStyle === 'label'
                  ? '#ffffff'
                  : settings.artDirection.inkColor,
                borderBottomColor: settings.accent,
                backgroundColor: settings.artDirection.dateHeadingStyle === 'label'
                  ? settings.accent
                  : 'transparent',
                padding: settings.artDirection.dateHeadingStyle === 'label' ? 5 : 0,
              },
            ]}
          >
            {formatBookDate(group.timestamp, settings.artDirection.dateStyle)}
          </Text>
          {group.messages.map((message) => (
            <MessageContent
              key={message.id}
              message={message}
              settings={settings}
              mediaUrls={mediaUrls}
              photoHeight={photoHeight}
              alternate={message.sender ? senders.indexOf(message.sender) % 2 === 1 : false}
            />
          ))}
        </View>
      ))}
    </View>
  )
}

function PageNumber({
  number,
  settings,
}: {
  number: number
  settings: BookSettings
}) {
  if (settings.artDirection.pageNumbers === 'hidden') return null
  const centered = settings.artDirection.pageNumbers === 'center'
  return (
    <Text
      style={[
        styles.pageNumber,
        {
          color: settings.artDirection.inkColor,
          ...(centered
            ? { left: '48%' }
            : number % 2 === 0
              ? { left: 14 }
              : { right: 14 }),
        },
      ]}
    >
      {number}
    </Text>
  )
}

export function DirectPdfDocument({
  settings,
  messages,
  pages,
  mediaUrls,
}: DirectPdfDocumentProps) {
  const dimensions = getPageDimensions(settings.format, settings.orientation)
  const size = {
    width: dimensions.widthMm * POINTS_PER_MM,
    height: dimensions.heightMm * POINTS_PER_MM,
  }
  const padding = pagePadding(settings)
  const decoration = getJournalPageDecoration(settings.artDirection, dimensions)
  const entries = getBookNavigationEntries(pages, settings)
  const participants = Array.from(new Set(messages.flatMap((message) => (
    message.sender ? [message.sender] : []
  ))))
  const creationDate = new Date(messages[0]?.timestamp ?? 0)
  const modificationDate = new Date(messages.at(-1)?.timestamp ?? creationDate.getTime())

  return (
    <Document
      title={settings.title || 'Livre Chatbound'}
      author={participants.join(', ') || 'Chatbound'}
      subject="Conversation mise en livre avec Chatbound"
      keywords="Chatbound, conversation, WhatsApp, livre"
      creator="Chatbound"
      producer="Chatbound PDF direct"
      language="fr-FR"
      pageMode="useOutlines"
      pageLayout="oneColumn"
      creationDate={creationDate}
      modificationDate={modificationDate}
    >
      <CoverPage
        settings={settings}
        messages={messages}
        pages={pages}
        mediaUrls={mediaUrls}
        size={size}
      />
      {pages.map((page, index) => {
        const number = index + 1
        const editorial = page[0]?.editorial
        return (
          <Page
            wrap={false}
            size={size}
            id={`page-${number}`}
            bookmark={pageBookmark(entries, number)}
            style={[
              styles.page,
              {
                width: size.width,
                height: size.height,
                minHeight: size.height,
                maxHeight: size.height,
                paddingTop: padding,
                paddingRight: padding,
                paddingBottom: padding + 5,
                paddingLeft: padding,
                color: settings.artDirection.inkColor,
                backgroundColor: settings.artDirection.paperColor,
                fontSize: 9 * settings.fontScale,
              },
            ]}
            key={page[0]?.id ?? `page-${number}`}
          >
            {decoration && editorial?.kind !== 'blank' ? (
              <Svg
                width={size.width}
                height={size.height}
                viewBox={`0 0 ${dimensions.widthMm} ${dimensions.heightMm}`}
                style={{ position: 'absolute', top: 0, left: 0 }}
              >
                <Path
                  d={decoration.path}
                  fill="none"
                  stroke={decoration.color}
                  strokeWidth={decoration.strokeWidth}
                  strokeLinecap="round"
                />
              </Svg>
            ) : null}
            {editorial?.kind === 'blank' ? null : editorial ? (
              <EditorialContent message={page[0]} settings={settings} />
            ) : isDesignedComposition(settings.theme) ? (
              <DesignedConversationContent page={page} settings={settings} mediaUrls={mediaUrls} />
            ) : (
              <ConversationContent
                page={page}
                settings={settings}
                mediaUrls={mediaUrls}
                contentHeight={size.height - padding * 2 - 8}
              />
            )}
            {editorial?.kind !== 'blank' ? (
              <PageNumber number={number} settings={settings} />
            ) : null}
          </Page>
        )
      })}
      {settings.backCover.enabled ? (
        <BackCoverPage
          settings={settings}
          messages={messages}
          pages={pages}
          mediaUrls={mediaUrls}
          size={size}
          pageIndex={pages.length + 1}
        />
      ) : null}
    </Document>
  )
}
