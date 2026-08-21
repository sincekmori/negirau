/**
 * The legal prose, deliberately OUTSIDE the Messages catalog: the catalog
 * rides every page's shared chunk, while these paragraphs are needed only on
 * /privacy and /terms — importing them here keeps them in those route chunks.
 */

import type { Locale, PolicySection } from "~/lib/i18n/messages";

export const PRIVACY_SECTIONS: Record<Locale, PolicySection[]> = {
	ja: [
		{
			title: "取得する情報と利用目的",
			body: "ねぎらいを送る操作について、氏名・メールアドレス・IPアドレスなど個人を特定できる情報は一切取得・保存しません。届け先を作成する操作についてのみ、作成者のIPアドレスと作成日時を保存します。利用目的は、削除請求および発信者情報開示請求など法令に基づく対応に限ります。これらの情報は届け先の削除とともに消去されます。",
		},
		{
			title: "外部送信について",
			body: "本サイトは、ボット対策のため Cloudflare Turnstile を、地図表示のため OpenFreeMap の地図タイルを、届け先の作成時の場所検索のため OpenStreetMap の Nominatim を利用しており、これらの利用時にお使いの端末の情報 (IPアドレス、ブラウザ情報、場所検索では入力した検索語) が各事業者へ送信されます。",
		},
		{
			title: "削除・利用停止の請求",
			body: "ご本人に関する届け先の削除や利用停止のご請求には、お問い合わせ窓口にて速やかに対応します。請求を受けた届け先はまず非表示とし、14日間の異議期間ののち削除します。",
		},
	],
	en: [
		{
			title: "What we collect and why",
			body: "Sending appreciation collects and stores no personally identifiable information — no name, no email address, no IP address. Creating a subject stores the creator's IP address and the creation time, used solely for legally mandated responses such as takedown and sender-information disclosure requests. This data is erased when the subject is deleted.",
		},
		{
			title: "Third-party transmissions",
			body: "This site uses Cloudflare Turnstile for bot protection, OpenFreeMap tiles for maps, and OpenStreetMap's Nominatim for the place search on the creation form; using them transmits device information (IP address, browser details, and for place search the typed query) to those providers.",
		},
		{
			title: "Takedown and suspension requests",
			body: "Requests concerning subjects about yourself are handled promptly via the contact address. A requested subject is hidden first, then deleted after a 14-day objection window.",
		},
	],
};

export const TERMS_SECTIONS: Record<Locale, PolicySection[]> = {
	ja: [
		{
			title: "適用",
			body: "本規約は、Negirau (以下「本サイト」) の利用に適用されます。本サイトを利用した時点で、本規約に同意したものとみなします。",
		},
		{
			title: "利用料金",
			body: "本サイトのすべての機能は無料で利用できます。利用料金は一切発生しません。",
		},
		{
			title: "商用利用",
			body: "本サイトのすべての機能と、本サイトが提供するもの (届け先、埋め込み画像、フィード、表示値など) は、利用の目的を問わず無償で利用できます。営利を目的とする法人が、社内の取り組みや業務の一環として利用することもできます。利用にあたって、運営者の許諾を得る必要はありません。ただし、次条の禁止事項は、利用の目的にかかわらず等しく適用されます。",
		},
		{
			title: "禁止事項",
			body: "他者になりすます行為、他者の権利 (商標、名誉、プライバシーなど) を侵害する行為、自動化された手段でリアクションを送信する行為、本サイトの運営を妨害する行為を禁止します。とりわけ、名称を自由に記述できることを利用して私人を晒す目的で届け先を作る行為、および、他者の名称や商標を含む届け先や埋め込み画像を、自己のものであるかのように、または自己と提携・承認の関係があるかのように掲げる行為を禁止します。",
		},
		{
			title: "届け先の掲載と削除",
			body: "届け先は対象への言及であり、本人性を主張するものではありません。掲載に問題がある場合は、お問い合わせ窓口から削除を請求できます。運営者は、届け先やリアクションを含む本サイト上のあらゆる情報を、必要と判断した場合に予告なく修正・削除できます。利用者はこれにあらかじめ同意するものとし、修正・削除により生じた損害について運営者は責任を負いません。",
		},
		{
			title: "サービスの変更と終了",
			body: "運営者は、本サイトの全部または一部を、予告なく変更・中断・終了することがあります。これにより生じた損害について、運営者は責任を負いません。",
		},
		{
			title: "免責",
			body: "本サイトは現状のまま提供され、表示内容の正確性や可用性を保証しません。本サイトの利用により生じた損害について、運営者は故意または重過失による場合を除き、責任を負いません。",
		},
		{
			title: "規約の変更と準拠法",
			body: "本規約は必要に応じて変更されることがあり、変更後の利用により同意したものとみなします。本規約は日本法に準拠します。",
		},
	],
	en: [
		{
			title: "Scope",
			body: "These terms govern the use of Negirau (the site). By using the site you agree to them.",
		},
		{
			title: "Fees",
			body: "Every feature of this site is free to use. No fees are charged, ever.",
		},
		{
			title: "Commercial use",
			body: "Every feature of this site, and everything it provides (subjects, embedded images, feeds, display values), is free to use for any purpose. A for-profit company may use it internally or as part of its business. No permission from the operator is required. The prohibited acts below apply regardless of the purpose of use.",
		},
		{
			title: "Prohibited acts",
			body: "Impersonating others, infringing the rights of others (trademarks, reputation, privacy), sending reactions by automated means, and interfering with the operation of the site are prohibited. In particular, do not exploit the free-form name field to create a subject that exposes a private individual, and do not present a subject or embedded image carrying someone else's name or trademark as your own, or as implying an affiliation with or endorsement by them.",
		},
		{
			title: "Listings and removal",
			body: "A subject is a reference to the party it names and claims no endorsement by it. If a listing is a problem, request its removal via the contact page. The operator may edit or remove any information on the site, including subjects and reactions, without notice whenever the operator deems it necessary. By using the site you accept this in advance, and the operator is not liable for damages arising from such edits or removals.",
		},
		{
			title: "Service changes and termination",
			body: "The operator may change, suspend, or terminate all or part of the site at any time without notice, and is not liable for damages arising from doing so.",
		},
		{
			title: "Disclaimer",
			body: "The site is provided as is, with no guarantee of accuracy or availability. The operator is not liable for damages arising from use of the site except in cases of intent or gross negligence.",
		},
		{
			title: "Changes and governing law",
			body: "These terms may change as needed; continued use constitutes agreement. They are governed by the laws of Japan.",
		},
	],
};
